import requests
import json
import pandas as pd
from datetime import datetime
import time
import sys

# Redirect debug messages to stderr
def debug_print(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)

class EtherscanScraper:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = "https://api.etherscan.io/v2/api"  # Updated to V2 API
        self.target_tokens = {
            'USDT': '0xdac17f958d2ee523a2206206994597c13d831ec7',  # Tether USD
            'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',  # USD Coin  
            'DAI': '0x6b175474e89094c44da98b954eedeac495271d0f'   # Dai Stablecoin
        }
        
    def get_token_transfers(self, address, start_block=0, end_block=99999999, page=1, offset=10000):
        """Get ERC-20 token transfers for an address"""
        params = {
            'chainid': 1,  # Ethereum mainnet for V2 API
            'module': 'account',
            'action': 'tokentx',
            'address': address,
            'startblock': start_block,
            'endblock': end_block,
            'page': page,
            'offset': offset,
            'sort': 'desc',
            'apikey': self.api_key
        }
        
        try:
            debug_print(f"Making V2 API request to: {self.base_url}")
            debug_print(f"Parameters: {params}")
            response = requests.get(self.base_url, params=params)
            response.raise_for_status()
            data = response.json()
            
            debug_print(f"API Response status: {data.get('status', 'Unknown')}")
            debug_print(f"API Response message: {data.get('message', 'No message')}")
            
            if data['status'] == '1':
                debug_print(f"Successfully retrieved {len(data.get('result', []))} transfers")
                return data['result']
            else:
                debug_print(f"API Error: {data.get('message', 'Unknown error')}")
                if "deprecated" in str(data.get('message', '')).lower():
                    debug_print("⚠️  This appears to be a V1 API deprecation error")
                    debug_print("✅ Current scraper is using V2 API - this should not happen")
                return []
                
        except requests.exceptions.RequestException as e:
            debug_print(f"Request error: {e}")
            return []
        except json.JSONDecodeError as e:
            debug_print(f"JSON decode error: {e}")
            return []
    
    def filter_incoming_transfers(self, transfers, target_address):
        """Filter for incoming transfers only"""
        incoming = []
        target_address = target_address.lower()
        
        for transfer in transfers:
            if transfer['to'].lower() == target_address:
                incoming.append(transfer)
        
        return incoming
    
    def filter_target_tokens(self, transfers):
        """Filter for USDT, USDC, and DAI tokens"""
        filtered = []
        
        for transfer in transfers:
            contract_address = transfer['contractAddress'].lower()
            
            # Check if this transfer is for one of our target tokens
            for token_name, token_address in self.target_tokens.items():
                if contract_address == token_address.lower():
                    transfer['token_symbol'] = token_name
                    filtered.append(transfer)
                    break
        
        return filtered
    
    def format_transfer_data(self, transfers):
        """Format transfer data for display"""
        formatted_data = []
        
        for transfer in transfers:
            # Convert timestamp to readable date
            timestamp = int(transfer['timeStamp'])
            date = datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')
            
            # Convert value from wei to readable format
            decimals = int(transfer['tokenDecimal'])
            value = int(transfer['value']) / (10 ** decimals)
            
            formatted_transfer = {
                'Date': date,
                'Token': transfer.get('token_symbol', transfer['tokenSymbol']),
                'Amount': f"{value:,.2f}",
                'From': transfer['from'],
                'Transaction Hash': transfer['hash'],
                'Block Number': transfer['blockNumber']
            }
            
            formatted_data.append(formatted_transfer)
        
        return formatted_data
    
    def scrape_incoming_transfers(self, address):
        """Main method to scrape incoming transfers for target tokens"""
        debug_print(f"Fetching token transfers for address: {address}")
        debug_print("=" * 60)
        
        # Get all token transfers
        all_transfers = self.get_token_transfers(address)
        
        if not all_transfers:
            debug_print("No transfers found or API error occurred.")
            return []
        
        debug_print(f"Total token transfers found: {len(all_transfers)}")
        
        # Filter for incoming transfers
        incoming_transfers = self.filter_incoming_transfers(all_transfers, address)
        debug_print(f"Incoming transfers: {len(incoming_transfers)}")
        
        # Filter for target tokens (USDT, USDC, DAI)
        target_transfers = self.filter_target_tokens(incoming_transfers)
        debug_print(f"Target token transfers (USDT, USDC, DAI): {len(target_transfers)}")
        
        # Format the data
        formatted_transfers = self.format_transfer_data(target_transfers)
        
        return formatted_transfers
    
    def calculate_total_value(self, transfers):
        """Calculate total value in USD (since USDT, USDC, DAI are stablecoins ≈ $1 each)"""
        total_value = 0.0
        token_totals = {}
        
        for transfer in transfers:
            token = transfer['Token']
            # Remove commas and convert to float
            amount = float(transfer['Amount'].replace(',', ''))
            total_value += amount
            
            if token in token_totals:
                token_totals[token] += amount
            else:
                token_totals[token] = amount
        
        return total_value, token_totals
    
    def save_to_csv(self, data, filename="incoming_token_transfers.csv"):
        """Save data to CSV file with total value summary at the end"""
        if data:
            df = pd.DataFrame(data)
            
            # Calculate total value
            total_value, token_totals = self.calculate_total_value(data)
            
            # Create summary rows
            summary_rows = []
            
            # Add empty row for separation
            summary_rows.append({
                'Date': '',
                'Token': '',
                'Amount': '',
                'From': '',
                'Transaction Hash': '',
                'Block Number': ''
            })
            
            # Add summary header
            summary_rows.append({
                'Date': 'SUMMARY',
                'Token': 'TOTAL VALUE',
                'Amount': '',
                'From': '',
                'Transaction Hash': '',
                'Block Number': ''
            })
            
            # Add individual token totals
            for token, amount in token_totals.items():
                summary_rows.append({
                    'Date': '',
                    'Token': f'{token} Total',
                    'Amount': f'{amount:,.2f}',
                    'From': '',
                    'Transaction Hash': '',
                    'Block Number': ''
                })
            
            # Add final total in USD
            summary_rows.append({
                'Date': '',
                'Token': 'TOTAL VALUE (USD)',
                'Amount': f'${total_value:,.2f}',
                'From': '',
                'Transaction Hash': '',
                'Block Number': ''
            })
            
            # Create summary dataframe and concatenate
            summary_df = pd.DataFrame(summary_rows)
            final_df = pd.concat([df, summary_df], ignore_index=True)
            
            # Save to CSV
            final_df.to_csv(filename, index=False)
            debug_print(f"\nData saved to {filename}")
            debug_print(f"Total value: ${total_value:,.2f}")
        else:
            debug_print("No data to save.")
    
    def display_transfers(self, transfers):
        """Display transfers in a formatted table"""
        if not transfers:
            debug_print("No incoming transfers found for the target tokens.")
            return
        
        debug_print(f"\nIncoming Token Transfers (USDT, USDC, DAI)")
        debug_print("=" * 100)
        
        for i, transfer in enumerate(transfers, 1):
            debug_print(f"\n{i}. {transfer['Token']} Transfer")
            debug_print(f"   Date: {transfer['Date']}")
            debug_print(f"   Amount: {transfer['Amount']} {transfer['Token']}")
            debug_print(f"   From: {transfer['From']}")
            debug_print(f"   Transaction: {transfer['Transaction Hash']}")
            debug_print(f"   Block: {transfer['Block Number']}")
        
        # Display total value
        total_value, token_totals = self.calculate_total_value(transfers)
        debug_print(f"\n" + "=" * 100)
        debug_print(f"VALUE SUMMARY:")
        for token, amount in token_totals.items():
            debug_print(f"{token} Total: {amount:,.2f}")
        debug_print(f"TOTAL VALUE: ${total_value:,.2f}")

def main():
    import sys
    import json
    
    # Check for command line arguments
    if len(sys.argv) > 1:
        target_address = sys.argv[1]
    else:
        target_address = "0x1896e1468878D0A8dE79398775200E6f00A2B6Dc"  # Default address
    
    if len(sys.argv) > 2:
        api_key = sys.argv[2]
    else:
        api_key = "1MBFZQA78GEHK1SV9M3WGKK39K9IS26ANX"  # Default API key
    
    try:
        # Create scraper instance
        scraper = EtherscanScraper(api_key)
        
        # Scrape incoming transfers
        transfers = scraper.scrape_incoming_transfers(target_address)
        
        # Calculate totals
        total_value, token_totals = scraper.calculate_total_value(transfers) if transfers else (0, {})
        
        # Output JSON for service integration
        result = {
            "success": True,
            "address": target_address,
            "transfers": transfers,
            "summary": {
                "total_transfers": len(transfers),
                "total_value": total_value,
                "token_totals": token_totals
            }
        }
        
        print(json.dumps(result, indent=2, default=str))
        
    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e),
            "address": target_address
        }
        print(json.dumps(error_result, indent=2))

if __name__ == "__main__":
    main()
