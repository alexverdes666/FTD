import requests
import pandas as pd
import time
from datetime import datetime
import json
import sys

# Redirect debug messages to stderr
def debug_print(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)

class TronScanScraper:
    def __init__(self, api_key=None):
        self.api_key = api_key
        self.base_url = "https://apilist.tronscanapi.com"
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        if api_key:
            self.headers['TRON-PRO-API-KEY'] = api_key
        
        # Token contract addresses on TRON network (verified from actual transfers)
        self.token_contracts = {
            'USDT': 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
            # Note: USDC and DAI contracts may not have transfers for this address
            'USDC': 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',
            'DAI': 'TKfjV9RNKJJCqPvBtK8L7Knykh7DNWvnYt'
        }
        
        # Rate limiting
        self.request_delay = 0.2  # 200ms between requests
        
    def get_all_transfers_for_address(self, address, start_timestamp=None, end_timestamp=None, limit=200):
        """
        Get all TRC20 transfers for an address first, then filter by token
        """
        endpoint = f"{self.base_url}/api/token_trc20/transfers"
        
        params = {
            'limit': limit,
            'start': 0,
            'relatedAddress': address
            # Don't filter by contract here - get all transfers
        }
        
        if start_timestamp:
            params['start_timestamp'] = start_timestamp
        if end_timestamp:
            params['end_timestamp'] = end_timestamp
            
        all_transfers = []
        
        debug_print(f"Fetching all TRC20 transfers for address...")
        
        try:
            response = requests.get(endpoint, params=params, headers=self.headers)
            response.raise_for_status()
            
            data = response.json()
            
            if 'token_transfers' not in data:
                debug_print("No token_transfers in API response")
                return []
                
            transfers = data['token_transfers']
            debug_print(f"  API returned {len(transfers)} total transfers")
            debug_print(f"  Total available: {data.get('total', 0)}")
            
            all_transfers = transfers
            
        except requests.exceptions.RequestException as e:
            debug_print(f"Error fetching transfers: {e}")
        except json.JSONDecodeError as e:
            debug_print(f"Error parsing JSON response: {e}")
            
        return all_transfers
    
    def get_token_transfers(self, address, token_symbol, all_transfers):
        """
        Filter transfers for a specific token and direction
        """
        if token_symbol not in self.token_contracts:
            raise ValueError(f"Token {token_symbol} not supported. Available: {list(self.token_contracts.keys())}")
        
        contract_address = self.token_contracts[token_symbol]
        
        # Filter transfers for this specific token
        token_transfers = [
            transfer for transfer in all_transfers
            if transfer.get('contract_address', '').lower() == contract_address.lower()
        ]
        
        debug_print(f"  Found {len(token_transfers)} total {token_symbol} transfers")
        
        # Filter for incoming transfers to our address
        incoming_transfers = [
            transfer for transfer in token_transfers 
            if transfer.get('to_address', '').lower() == address.lower()
        ]
        
        # Filter for outgoing transfers from our address (for debugging)
        outgoing_transfers = [
            transfer for transfer in token_transfers 
            if transfer.get('from_address', '').lower() == address.lower()
        ]
        
        debug_print(f"  Found {len(incoming_transfers)} incoming, {len(outgoing_transfers)} outgoing {token_symbol} transfers")
        
        return incoming_transfers
    
    def get_all_incoming_transfers(self, address, tokens=['USDT', 'USDC', 'DAI'], 
                                 start_timestamp=None, end_timestamp=None, limit=200):
        """
        Get incoming transfers for all specified tokens
        """
        # First, get all transfers for the address
        debug_print(f"\n=== Fetching all transfers for address ===")
        all_raw_transfers = self.get_all_transfers_for_address(
            address, start_timestamp, end_timestamp, limit
        )
        
        if not all_raw_transfers:
            debug_print("No transfers found for this address")
            return []
        
        all_incoming_transfers = []
        
        # Then filter for each requested token
        for token in tokens:
            debug_print(f"\n=== Analyzing {token} transfers ===")
            incoming_transfers = self.get_token_transfers(address, token, all_raw_transfers)
            
            # Add token symbol to each transfer record
            for transfer in incoming_transfers:
                transfer['token_symbol'] = token
                
            all_incoming_transfers.extend(incoming_transfers)
            debug_print(f"Added {len(incoming_transfers)} incoming {token} transfers to results")
        
        return all_incoming_transfers
    
    def parse_transfer_data(self, transfers):
        """
        Parse transfer data into a structured format
        """
        parsed_data = []
        
        for transfer in transfers:
            try:
                # Convert timestamp to readable date
                timestamp = transfer.get('block_ts', 0)
                date = datetime.fromtimestamp(timestamp / 1000) if timestamp else None
                
                # Get token info
                token_info = transfer.get('tokenInfo', {})
                token_decimal = int(token_info.get('tokenDecimal', 0))
                
                # Calculate actual amount (divide by 10^decimals)
                raw_amount = int(transfer.get('quant', 0))
                actual_amount = raw_amount / (10 ** token_decimal) if token_decimal > 0 else raw_amount
                
                parsed_transfer = {
                    'transaction_id': transfer.get('transaction_id', ''),
                    'date': date.strftime('%Y-%m-%d %H:%M:%S') if date else '',
                    'timestamp': timestamp,
                    'from_address': transfer.get('from_address', ''),
                    'to_address': transfer.get('to_address', ''),
                    'token_symbol': transfer.get('token_symbol', ''),
                    'token_name': token_info.get('tokenName', ''),
                    'amount': actual_amount,
                    'raw_amount': raw_amount,
                    'token_decimals': token_decimal,
                    'status': transfer.get('status', ''),
                    'confirmed': transfer.get('confirmed', False),
                    'contract_address': transfer.get('contract_address', ''),
                    'block_number': transfer.get('block', 0)
                }
                
                parsed_data.append(parsed_transfer)
                
            except Exception as e:
                debug_print(f"Error parsing transfer: {e}")
                continue
                
        return parsed_data
    
    def save_to_csv(self, transfers, filename="tron_incoming_transfers.csv"):
        """
        Save transfers to CSV file
        """
        if not transfers:
            debug_print("No transfers to save")
            return
            
        df = pd.DataFrame(transfers)
        
        # Sort by timestamp (newest first)
        df = df.sort_values('timestamp', ascending=False)
        
        # Select and reorder columns
        columns = [
            'date', 'token_symbol', 'token_name', 'amount', 
            'from_address', 'to_address', 'transaction_id', 
            'status', 'confirmed', 'contract_address'
        ]
        
        df = df[columns]
        df.to_csv(filename, index=False)
        debug_print(f"\nSaved {len(transfers)} transfers to {filename}")
        
        # Print summary
        debug_print("\n=== SUMMARY ===")
        token_summary = df.groupby('token_symbol')['amount'].agg(['count', 'sum'])
        for token, data in token_summary.iterrows():
            debug_print(f"{token}: {data['count']} transfers, Total: {data['sum']:.6f}")
            
        return df

def main():
    import sys
    import json
    
    # Check for command line arguments
    if len(sys.argv) > 1:
        address = sys.argv[1]
    else:
        address = "TQJAhuv9NYNcsvpvThRXZHafQNa1hmBGSi"  # Default address
    
    api_key = "154d9b76-82b2-457e-b72a-7011f19d403a"  # Default API key
    tokens = ['USDT', 'USDC', 'DAI']
    
    try:
        # Initialize scraper
        scraper = TronScanScraper(api_key=api_key)
        
        # Get all incoming transfers
        raw_transfers = scraper.get_all_incoming_transfers(
            address=address,
            tokens=tokens,
            limit=100
        )
        
        # Parse and structure the data
        parsed_transfers = scraper.parse_transfer_data(raw_transfers) if raw_transfers else []
        
        # Calculate summary
        total_value = sum(transfer['amount'] for transfer in parsed_transfers)
        token_summary = {}
        for transfer in parsed_transfers:
            token = transfer['token_symbol']
            if token in token_summary:
                token_summary[token] += transfer['amount']
            else:
                token_summary[token] = transfer['amount']
        
        # Output JSON for service integration
        result = {
            "success": True,
            "address": address,
            "transfers": parsed_transfers,
            "summary": {
                "total_transfers": len(parsed_transfers),
                "total_value": total_value,
                "token_totals": token_summary
            }
        }
        
        print(json.dumps(result, indent=2, default=str))
        
    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e),
            "address": address
        }
        print(json.dumps(error_result, indent=2))

if __name__ == "__main__":
    main()
