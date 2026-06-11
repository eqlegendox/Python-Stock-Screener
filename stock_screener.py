# Imports
from io import StringIO
import yfinance as yf
import pandas as pd
import datetime
import time
import kagglehub
import os

# Get tickers for all S&P 500 stocks from Kaggle dataset
def tickers_sp500():
    # Download latest version of S&P 500 dataset
    path = kagglehub.dataset_download("andrewmvd/sp-500-stocks")
    print("Path to dataset files:", path)
    
    # Read the companies CSV file (contains ticker symbols)
    csv_files = os.listdir(path)
    print(f"Available files: {csv_files}")
    
    # Find the file with company information
    company_file = [f for f in csv_files if 'companies' in f.lower() or 'constituents' in f.lower()]
    if company_file:
        df = pd.read_csv(os.path.join(path, company_file[0]))
    else:
        # Try the first CSV file
        df = pd.read_csv(os.path.join(path, csv_files[0]))
    
    # Extract tickers (adjust column name based on actual dataset structure)
    if 'Symbol' in df.columns:
        tickers = df['Symbol'].tolist()
    elif 'Ticker' in df.columns:
        tickers = df['Ticker'].tolist()
    else:
        # Print columns to help debug
        print(f"Available columns: {df.columns.tolist()}")
        tickers = df.iloc[:, 0].tolist()  # Use first column as fallback
    
    return tickers

# Variables
tickers = tickers_sp500()
tickers = [item.replace(".", "-") for item in tickers] # Yahoo Finance uses dashes instead of dots
index_name = '^GSPC' # S&P 500
start_date = datetime.datetime.now() - datetime.timedelta(days=365)
end_date = datetime.date.today()
exportList = pd.DataFrame(columns=['Stock', "RS_Rating", "50 Day MA", "150 Day MA", "200 Day MA", "52 Week Low", "52 Week High"])
returns_multiples = []

print(f"\nTotal tickers to process: {len(tickers)}\n")

# Index Returns
print(f"Downloading {index_name} data...")
index_df = yf.download(index_name, start=start_date, end=end_date, progress=False)
index_df['Percent Change'] = index_df['Close'].pct_change()
index_return = (index_df['Percent Change'] + 1).cumprod().iloc[-1]
print(f"Index return: {index_return:.4f}\n")

# Find top 30% performing stocks (relative to the S&P 500)
print("Analyzing individual stocks...")
for i, ticker in enumerate(tickers, 1):
    csv_file = f'{ticker}.csv'
    
    # Check if CSV already exists
    if os.path.exists(csv_file):
        try:
            # Load existing CSV
            df = pd.read_csv(csv_file, index_col=0)
            
            # Flatten MultiIndex columns if present
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
            
            # Check if dataframe is empty
            if df.empty:
                print(f'[{i}/{len(tickers)}] {ticker}: Cached CSV is empty, re-downloading...')
                raise ValueError("Empty CSV")
            
            # Calculating returns relative to the market (returns multiple)
            df['Percent Change'] = df['Close'].pct_change()
            stock_return = (df['Percent Change'] + 1).cumprod().iloc[-1]
            returns_multiple = round((stock_return / index_return), 2)
            returns_multiples.append(returns_multiple)
            
            if i % 50 == 0:  # Print progress every 50 stocks
                print(f'[{i}/{len(tickers)}] Progress update... (using cached data)')
            
            continue  # Skip to next ticker
            
        except Exception as e:
            print(f'[{i}/{len(tickers)}] {ticker}: Error reading cached CSV ({e}), re-downloading...')
    
    # Download if CSV doesn't exist or had errors
    try:
        # Download historical data
        df = yf.download(ticker, start=start_date, end=end_date, progress=False)
        
        # Check if dataframe is empty
        if df.empty:
            print(f'[{i}/{len(tickers)}] {ticker}: No data available')
            returns_multiples.append(0)
            continue
        
        # Flatten MultiIndex columns if present
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
            
        # Save to CSV
        df.to_csv(csv_file)

        # Calculating returns relative to the market (returns multiple)
        df['Percent Change'] = df['Close'].pct_change()
        stock_return = (df['Percent Change'] + 1).cumprod().iloc[-1]
        returns_multiple = round((stock_return / index_return), 2)
        returns_multiples.append(returns_multiple)
        
        if i % 50 == 0:  # Print progress every 50 stocks
            print(f'[{i}/{len(tickers)}] Progress update...')
            
    except Exception as e:
        print(f'[{i}/{len(tickers)}] {ticker}: Error - {e}')
        returns_multiples.append(0)
    
    time.sleep(0.1)

print(f"\nCompleted downloading {len(tickers)} stocks")

# Creating dataframe of only top 30%
print("\nFiltering top 30% performers...")
rs_df = pd.DataFrame(list(zip(tickers, returns_multiples)), columns=['Ticker', 'Returns_multiple'])
rs_df['RS_Rating'] = rs_df['Returns_multiple'].rank(pct=True) * 100
rs_df = rs_df[rs_df['RS_Rating'] >= rs_df['RS_Rating'].quantile(.70)]

print(f"Top 30% contains {len(rs_df)} stocks\n")

# Checking Minervini conditions of top 30% of stocks in given list
print("Checking Minervini trend template conditions...")
rs_stocks = rs_df['Ticker']

for stock in rs_stocks:    
    try:
        df = pd.read_csv(f'{stock}.csv', index_col=0)
        
        # Flatten MultiIndex columns if present
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        
        # Use 'Close' instead of 'Adj Close' since we're using auto_adjust=True by default
        price_col = 'Close'
        
        sma = [50, 150, 200]
        for x in sma:
            df[f"SMA_{x}"] = df[price_col].rolling(window=x).mean().round(2)
        
        # Storing required values 
        currentClose = df[price_col].iloc[-1]
        moving_average_50 = df["SMA_50"].iloc[-1]
        moving_average_150 = df["SMA_150"].iloc[-1]
        moving_average_200 = df["SMA_200"].iloc[-1]
        low_of_52week = round(df["Low"].iloc[-260:].min(), 2)
        high_of_52week = round(df["High"].iloc[-260:].max(), 2)
        RS_Rating = round(rs_df[rs_df['Ticker']==stock]['RS_Rating'].iloc[0])
        
        try:
            moving_average_200_20 = df["SMA_200"].iloc[-20]
        except Exception:
            moving_average_200_20 = 0

        # Condition 1: Current Price > 150 SMA and > 200 SMA
        condition_1 = currentClose > moving_average_150 > moving_average_200
        
        # Condition 2: 150 SMA and > 200 SMA
        condition_2 = moving_average_150 > moving_average_200

        # Condition 3: 200 SMA trending up for at least 1 month
        condition_3 = moving_average_200 > moving_average_200_20
        
        # Condition 4: 50 SMA> 150 SMA and 50 SMA> 200 SMA
        condition_4 = moving_average_50 > moving_average_150 > moving_average_200
           
        # Condition 5: Current Price > 50 SMA
        condition_5 = currentClose > moving_average_50
           
        # Condition 6: Current Price is at least 30% above 52 week low
        condition_6 = currentClose >= (1.3*low_of_52week)
           
        # Condition 7: Current Price is within 25% of 52 week high
        condition_7 = currentClose >= (.75*high_of_52week)
        
        # If all conditions above are true, add stock to exportList
        if(condition_1 and condition_2 and condition_3 and condition_4 and condition_5 and condition_6 and condition_7):
            listAdd = pd.DataFrame({
                'Stock': [stock], 
                "RS_Rating": [RS_Rating],
                "50 Day MA": [moving_average_50], 
                "150 Day MA": [moving_average_150], 
                "200 Day MA": [moving_average_200], 
                "52 Week Low": [low_of_52week], 
                "52 Week High": [high_of_52week]
            })
            exportList = pd.concat([exportList, listAdd], ignore_index=True)
        else:
            print(f"✗ {stock} does not meet conditions")
    except Exception as e:
        print(f"✗ {stock}: Error - {e}")

exportList = exportList.sort_values(by='RS_Rating', ascending=False)

if not exportList.empty:
    print(exportList.to_string(index=False))
else:
    print("No stocks found meeting all criteria")

# Export to Excel
with pd.ExcelWriter("ScreenOutput.xlsx", engine='openpyxl') as writer:
    exportList.to_excel(writer, sheet_name="Sheet1", index=False)

print(f"\n✓ Results saved to ScreenOutput.xlsx")