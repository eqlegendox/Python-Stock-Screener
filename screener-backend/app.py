"""Flask sidecar — serves live yfinance screening data to the Next.js frontend."""

import time
from datetime import datetime, timezone

from flask import Flask, jsonify, request
from flask_cors import CORS

from screener import build_screen

app = Flask(__name__)
CORS(app)

CACHE_TTL = 60  # seconds

_cache: dict = {"rows": None, "ts": 0.0}


def _get_cached_rows() -> list[dict] | None:
    if _cache["rows"] is not None and (time.time() - _cache["ts"]) < CACHE_TTL:
        return _cache["rows"]
    return None


def _refresh_cache(rs_cutoff: float, pct_above_low: float, pct_below_high: float) -> list[dict]:
    rows = build_screen(rs_cutoff, pct_above_low, pct_below_high)
    _cache["rows"] = rows
    _cache["ts"] = time.time()
    return rows


@app.route("/api/screener")
def screener():
    rs_min = float(request.args.get("rsMin", 0))
    pct_above_low = float(request.args.get("pctAboveLow", 0))
    pct_below_high = float(request.args.get("pctBelowHigh", 100))

    rows = _get_cached_rows()
    if rows is None:
        rows = _refresh_cache(rs_min, pct_above_low, pct_below_high)

    # Apply query-param filters on top of cached universe.
    filtered = [
        r for r in rows
        if r["rsRating"] >= rs_min
        and r["pctFromLow"] >= pct_above_low
        and r["pctFromHigh"] >= -pct_below_high
    ]

    strong_count = sum(1 for r in filtered if r["signal"] == "STRONG")
    passing_count = sum(1 for r in filtered if r["passes"])

    return jsonify({
        "generatedAt": datetime.fromtimestamp(_cache["ts"], tz=timezone.utc).isoformat(),
        "count": len(filtered),
        "passing": passing_count,
        "strongCount": strong_count,
        "stocks": filtered,
    })


@app.route("/api/screener/refresh", methods=["POST"])
def refresh():
    _cache["rows"] = None
    _cache["ts"] = 0.0
    rows = _refresh_cache(70, 30, 25)
    strong_count = sum(1 for r in rows if r["signal"] == "STRONG")
    return jsonify({
        "generatedAt": datetime.fromtimestamp(_cache["ts"], tz=timezone.utc).isoformat(),
        "count": len(rows),
        "passing": sum(1 for r in rows if r["passes"]),
        "strongCount": strong_count,
        "message": "Cache refreshed",
    })


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
