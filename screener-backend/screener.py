"""Pure computation — no Flask. Fetches S&P 500 via yfinance and computes
all screening metrics: IBD-style RS rating, Minervini conditions, signal."""

import numpy as np
import pandas as pd
import yfinance as yf
from scipy.stats import percentileofscore


def get_sp500_tickers() -> list[str]:
    tables = pd.read_html(
        "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies", header=0
    )
    return tables[0]["Symbol"].str.replace(".", "-", regex=False).tolist()


def _sma(closes: np.ndarray, window: int) -> np.ndarray:
    """Trailing SMA; NaN until `window` samples exist."""
    out = np.full(len(closes), np.nan)
    if len(closes) < window:
        return out
    cumsum = np.cumsum(np.insert(closes, 0, 0))
    out[window - 1 :] = (cumsum[window:] - cumsum[:-window]) / window
    return out


def _downsample(values: list[float], n: int = 64) -> list[float]:
    if len(values) <= n:
        return list(values)
    indices = [round(i / (n - 1) * (len(values) - 1)) for i in range(n)]
    return [round(values[i], 4) for i in indices]


def _ibd_weighted_return(closes: np.ndarray, q: int = 63) -> float:
    """IBD-style weighted 12-month return: Q4×40% + Q3×20% + Q2×20% + Q1×20%."""
    n = len(closes)
    if n < q * 4:
        return float(closes[-1] / closes[0] - 1) if n >= 2 else 0.0

    def qret(start: int, end: int) -> float:
        return float(closes[end] / closes[start] - 1)

    q1 = qret(n - 4 * q, n - 3 * q)
    q2 = qret(n - 3 * q, n - 2 * q)
    q3 = qret(n - 2 * q, n - q)
    q4 = qret(n - q, n - 1)
    return q1 * 0.20 + q2 * 0.20 + q3 * 0.20 + q4 * 0.40


def compute_metrics(ticker: str, df: pd.DataFrame) -> dict | None:
    """Compute all screen metrics for one ticker's OHLCV DataFrame."""
    if df is None or len(df) < 200:
        return None

    df = df.dropna(subset=["Close"])
    if len(df) < 200:
        return None

    closes = df["Close"].values.astype(float)
    highs = df["High"].values.astype(float)
    lows = df["Low"].values.astype(float)
    volumes = df["Volume"].values.astype(float)
    dates = df.index.strftime("%Y-%m-%d").tolist()

    n = len(closes)
    sma50 = _sma(closes, 50)
    sma150 = _sma(closes, 150)
    sma200 = _sma(closes, 200)

    cur = float(closes[-1])
    window52 = slice(max(0, n - 260), n)
    high52 = float(np.max(highs[window52]))
    low52 = float(np.min(lows[window52]))
    sma200_prev = float(sma200[n - 21]) if n >= 221 and not np.isnan(sma200[n - 21]) else 0.0
    avg_vol = float(np.mean(volumes[max(0, n - 20) :]))

    sparkline = _downsample(closes.tolist())

    return {
        "ticker": ticker,
        "currentClose": round(cur, 4),
        "sma50": round(float(sma50[-1]), 4) if not np.isnan(sma50[-1]) else None,
        "sma150": round(float(sma150[-1]), 4) if not np.isnan(sma150[-1]) else None,
        "sma200": round(float(sma200[-1]), 4) if not np.isnan(sma200[-1]) else None,
        "sma200Prev": round(sma200_prev, 4),
        "high52": round(high52, 4),
        "low52": round(low52, 4),
        "pctFromHigh": round((cur - high52) / high52 * 100, 2),
        "pctFromLow": round((cur - low52) / low52 * 100, 2),
        "return1y": round((cur / float(closes[0]) - 1) * 100, 2),
        "avgVolume": int(avg_vol),
        "lastDate": dates[-1],
        "sparkline": sparkline,
        "_weighted_rs_score": _ibd_weighted_return(closes),
    }


def _num(v: float | None) -> float:
    return v if v is not None else float("-inf")


def minervini_conditions(m: dict, rs_cutoff: float, min_pct_above_low: float, max_pct_below_high: float) -> dict:
    """Evaluate 8 Minervini trend-template conditions. Returns {conditions, passes, met}."""
    cur = m["currentClose"]
    s50 = _num(m["sma50"])
    s150 = _num(m["sma150"])
    s200 = _num(m["sma200"])
    s200p = m["sma200Prev"]
    low52 = m["low52"]
    high52 = m["high52"]
    rs = m["rsRating"]

    conds = {
        "priceAboveMa150Ma200": cur > s150 and s150 > s200,
        "ma150AboveMa200": s150 > s200,
        "ma200TrendingUp": s200 > s200p,
        "maStacked": s50 > s150 and s150 > s200,
        "priceAboveMa50": cur > s50,
        "aboveLow": cur >= low52 * (1 + min_pct_above_low / 100),
        "nearHigh": cur >= high52 * (1 - max_pct_below_high / 100),
        "rsRating": rs >= rs_cutoff,
    }
    met = sum(conds.values())
    return {"conditions": conds, "passes": met == 8, "met": met}


def signal_for(passes: bool, met: int, rs: float) -> str:
    if passes:
        return "STRONG"
    if met >= 6 and rs >= 60:
        return "SETUP"
    if met >= 3 or rs >= 40:
        return "WEAK"
    return "AVOID"


def build_screen(rs_cutoff: float = 70, min_pct_above_low: float = 30, max_pct_below_high: float = 25) -> list[dict]:
    """Download 1y OHLCV for S&P 500, compute all metrics, return sorted rows."""
    tickers = get_sp500_tickers()

    raw = yf.download(
        tickers,
        period="1y",
        interval="1d",
        auto_adjust=True,
        threads=True,
        progress=False,
    )

    metrics_list: list[dict] = []
    for ticker in tickers:
        try:
            if isinstance(raw.columns, pd.MultiIndex):
                df = raw.xs(ticker, axis=1, level=1).copy() if ticker in raw.columns.get_level_values(1) else None
            else:
                df = raw if len(tickers) == 1 else None

            if df is None:
                continue
            m = compute_metrics(ticker, df)
            if m:
                metrics_list.append(m)
        except Exception:
            continue

    if not metrics_list:
        return []

    # Percentile-rank weighted RS scores across universe → 0-100.
    scores = [m["_weighted_rs_score"] for m in metrics_list]
    for m in metrics_list:
        m["rsRating"] = round(float(percentileofscore(scores, m["_weighted_rs_score"], kind="rank")), 1)
        del m["_weighted_rs_score"]

    rows = []
    for m in metrics_list:
        cond_result = minervini_conditions(m, rs_cutoff, min_pct_above_low, max_pct_below_high)
        row = {
            **m,
            "passes": cond_result["passes"],
            "conditionsMet": cond_result["met"],
            "signal": signal_for(cond_result["passes"], cond_result["met"], m["rsRating"]),
        }
        rows.append(row)

    rows.sort(key=lambda r: r["rsRating"], reverse=True)
    return rows
