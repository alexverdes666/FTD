import requests
import pandas as pd
import json
import time
from datetime import datetime
import csv
import os
import sys

# Redirect debug messages to stderr
def debug_print(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)

class BitcoinAddressScraper:
    def __init__(self):
        self.target_address = "bc1qxm0m3g2k0lfj37slknha946hgk4aekhwc7dsj3"
        self.target_tokens = ["USDT", "USDC", "DAI"]
        self.api_base = "https://blockchain.info"
        self.api_base_com = "https://blockstream.info/api"  # Alternative API
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        self.btc_price_usd = None
        
    def get_btc_price(self):
        """
        Fetch current BTC price in USD from CoinGecko API
        """
        try:
            url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            price = data['bitcoin']['usd']
            self.btc_price_usd = price
            debug_print(f"Current BTC price: ${price:,.2f} USD")
            return price
            
        except Exception as e:
            debug_print(f"Error fetching BTC price: {e}")
            # Fallback to a reasonable price if API fails
            self.btc_price_usd = 50000  # Fallback price
            debug_print(f"Using fallback BTC price: ${self.btc_price_usd:,.2f} USD")
            return self.btc_price_usd
        
    def calculate_usd_value(self, btc_amount):
        """
        Calculate USD value for a given BTC amount
        """
        if self.btc_price_usd is None:
            self.get_btc_price()
        
        return btc_amount * self.btc_price_usd
    
    def get_address_transactions(self, address, limit=100):
        """
        Fetch transactions for a Bitcoin address using blockchain.info API
        """
        try:
            # Try blockchain.info first
            url = f"{self.api_base}/rawaddr/{address}?limit={limit}"
            debug_print(f"Fetching transactions from: {url}")
            
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            
            data = response.json()
            return data
            
        except Exception as e:
            debug_print(f"Error fetching from blockchain.info: {e}")
            
            # Try alternative API
            try:
                url = f"{self.api_base_com}/address/{address}/txs"
                debug_print(f"Trying alternative API: {url}")
                
                response = requests.get(url, headers=self.headers)
                response.raise_for_status()
                
                data = response.json()
                return self.convert_blockstream_format(data)
                
            except Exception as e2:
                debug_print(f"Error fetching from alternative API: {e2}")
                return None
    
    def convert_blockstream_format(self, blockstream_data):
        """
        Convert blockstream API format to blockchain.info format
        """
        converted = {
            'address': self.target_address,
            'total_received': 0,
            'total_sent': 0,
            'balance': 0,
            'txs': []
        }
        
        for tx in blockstream_data:
            converted_tx = {
                'hash': tx.get('txid', ''),
                'time': tx.get('status', {}).get('block_time', 0),
                'block_height': tx.get('status', {}).get('block_height', 0),
                'inputs': [],
                'out': []
            }
            
            # Convert inputs
            for inp in tx.get('vin', []):
                converted_tx['inputs'].append({
                    'prev_out': {
                        'addr': inp.get('prevout', {}).get('scriptpubkey_address', ''),
                        'value': inp.get('prevout', {}).get('value', 0)
                    }
                })
            
            # Convert outputs
            for out in tx.get('vout', []):
                converted_tx['out'].append({
                    'addr': out.get('scriptpubkey_address', ''),
                    'value': out.get('value', 0)
                })
            
            converted['txs'].append(converted_tx)
        
        return converted
    
    def check_for_omni_tokens(self, tx_hash):
        """
        Check if a transaction contains Omni Layer tokens (like USDT)
        """
        try:
            # Omni Layer API endpoint
            url = f"https://api.omniexplorer.info/v1/transaction/tx/{tx_hash}"
            
            response = requests.get(url, headers=self.headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data and isinstance(data, list) and len(data) > 0:
                    return data[0]
            return None
            
        except Exception as e:
            # Don't print error for every transaction, as most won't have Omni tokens
            return None
    
    def analyze_transaction(self, tx):
        """
        Analyze a transaction to find incoming token transfers and regular Bitcoin transfers
        """
        incoming_transfers = []
        bitcoin_transfers = []
        tx_hash = tx.get('hash', '')
        tx_time = tx.get('time', 0)
        
        # Convert timestamp to readable date
        if tx_time:
            try:
                date_str = datetime.fromtimestamp(tx_time).strftime('%Y-%m-%d %H:%M:%S')
            except:
                date_str = str(tx_time)
        else:
            date_str = "Unknown"
        
        # Check for regular Bitcoin transfers to our address
        for output in tx.get('out', []):
            if output.get('addr') == self.target_address:
                amount_satoshi = output.get('value', 0)
                amount_btc = amount_satoshi / 100000000  # Convert satoshi to BTC
                
                # Find sender address from inputs
                sender_addresses = []
                for inp in tx.get('inputs', []):
                    prev_out = inp.get('prev_out', {})
                    sender_addr = prev_out.get('addr', '')
                    if sender_addr and sender_addr != self.target_address:
                        sender_addresses.append(sender_addr)
                
                if amount_btc > 0:
                    # Calculate USD value
                    amount_usd = self.calculate_usd_value(amount_btc)
                    
                    bitcoin_transfer = {
                        'date': date_str,
                        'amount_btc': amount_btc,
                        'amount_usd': amount_usd,
                        'amount_satoshi': amount_satoshi,
                        'from_addresses': sender_addresses,
                        'transaction_id': tx_hash,
                        'type': 'incoming'
                    }
                    bitcoin_transfers.append(bitcoin_transfer)
        
        # Check for Omni Layer tokens (USDT, etc.)
        omni_data = self.check_for_omni_tokens(tx_hash)
        if omni_data:
            token_info = self.parse_omni_transaction(omni_data, tx_time, tx_hash)
            if token_info:
                incoming_transfers.extend(token_info)
        
        return incoming_transfers, bitcoin_transfers
    
    def parse_omni_transaction(self, omni_data, tx_time, tx_hash):
        """
        Parse Omni Layer transaction data for token transfers
        """
        transfers = []
        
        try:
            # Check if this is a token transfer to our address
            receiving_address = omni_data.get('referenceaddress', '')
            sending_address = omni_data.get('sendingaddress', '')
            
            if receiving_address == self.target_address:
                property_id = omni_data.get('propertyid', '')
                property_name = omni_data.get('propertyname', '')
                amount = omni_data.get('amount', '0')
                
                # Check if this is one of our target tokens
                if any(token.upper() in property_name.upper() for token in self.target_tokens):
                    token_symbol = property_name.split()[0] if property_name else f"OMNI_{property_id}"
                    
                    # Convert timestamp to readable date
                    if tx_time:
                        try:
                            date_str = datetime.fromtimestamp(tx_time).strftime('%Y-%m-%d %H:%M:%S')
                        except:
                            date_str = str(tx_time)
                    else:
                        date_str = "Unknown"
                    
                    transfer = {
                        'date': date_str,
                        'token_symbol': token_symbol,
                        'token_name': property_name,
                        'amount': amount,
                        'from_address': sending_address,
                        'to_address': receiving_address,
                        'transaction_id': tx_hash,
                        'status': '1' if omni_data.get('valid', False) else '0',
                        'confirmed': True,
                        'contract_address': f"omni_property_{property_id}",
                        'protocol': 'Omni Layer'
                    }
                    transfers.append(transfer)
                else:
                    # Log other Omni tokens found for informational purposes
                    debug_print(f"    Found Omni token: {property_name} (Property ID: {property_id}) - Amount: {amount}")
        
        except Exception as e:
            debug_print(f"Error parsing Omni transaction: {e}")
        
        return transfers
    
    def scrape_address_transfers(self):
        """
        Main function to scrape token transfers for the target address
        """
        debug_print(f"Starting Bitcoin address scraper for: {self.target_address}")
        debug_print(f"Looking for tokens: {', '.join(self.target_tokens)}")
        
        # Get transaction data
        tx_data = self.get_address_transactions(self.target_address, limit=1000)
        
        if not tx_data:
            debug_print("Failed to fetch transaction data")
            return [], []
        
        total_received = tx_data.get('total_received', 0) / 100000000
        total_sent = tx_data.get('total_sent', 0) / 100000000
        balance = tx_data.get('final_balance', 0) / 100000000
        
        debug_print(f"Address Summary:")
        debug_print(f"  Total Received: {total_received} BTC")
        debug_print(f"  Total Sent: {total_sent} BTC") 
        debug_print(f"  Current Balance: {balance} BTC")
        debug_print(f"  Number of transactions: {len(tx_data.get('txs', []))}")
        debug_print()
        
        all_token_transfers = []
        all_bitcoin_transfers = []
        
        # Analyze each transaction
        for i, tx in enumerate(tx_data.get('txs', [])):
            debug_print(f"Analyzing transaction {i+1}/{len(tx_data.get('txs', []))}: {tx.get('hash', '')[:16]}...")
            
            token_transfers, bitcoin_transfers = self.analyze_transaction(tx)
            all_token_transfers.extend(token_transfers)
            all_bitcoin_transfers.extend(bitcoin_transfers)
            
            # Add delay to avoid rate limiting
            if i % 5 == 0 and i > 0:
                time.sleep(0.5)
        
        return all_token_transfers, all_bitcoin_transfers
    
    def save_to_csv(self, transfers, filename="btc_incoming_token_transfers.csv"):
        """
        Save transfers to CSV file
        """
        if not transfers:
            debug_print("No token transfers found to save")
            return
        
        # Define CSV headers
        headers = [
            'date', 'token_symbol', 'token_name', 'amount', 
            'from_address', 'to_address', 'transaction_id', 
            'status', 'confirmed', 'contract_address', 'protocol'
        ]
        
        try:
            with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=headers)
                writer.writeheader()
                
                for transfer in transfers:
                    # Ensure all required fields are present
                    row = {}
                    for header in headers:
                        row[header] = transfer.get(header, '')
                    writer.writerow(row)
            
            debug_print(f"Saved {len(transfers)} transfers to {filename}")
            
        except Exception as e:
            debug_print(f"Error saving to CSV: {e}")
    
    def save_bitcoin_transfers_to_csv(self, transfers, filename="btc_bitcoin_transfers.csv"):
        """
        Save Bitcoin transfers to CSV file for reference
        """
        if not transfers:
            debug_print("No Bitcoin transfers found to save")
            return
        
        # Define CSV headers for Bitcoin transfers - now including USD values
        headers = [
            'date', 'amount_btc', 'amount_usd', 'amount_satoshi', 
            'from_addresses', 'transaction_id', 'type'
        ]
        
        try:
            with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=headers)
                writer.writeheader()
                
                for transfer in transfers:
                    # Convert from_addresses list to string
                    row = transfer.copy()
                    row['from_addresses'] = ', '.join(transfer.get('from_addresses', []))
                    writer.writerow(row)
            
            # Add summary to CSV
            if transfers:
                total_btc = sum(transfer['amount_btc'] for transfer in transfers)
                total_usd = sum(transfer['amount_usd'] for transfer in transfers)
                
                # Add summary rows
                with open(filename, 'a', newline='', encoding='utf-8') as csvfile:
                    writer = csv.DictWriter(csvfile, fieldnames=headers)
                    
                    # Empty row for separation
                    writer.writerow({header: '' for header in headers})
                    
                    # Summary header
                    writer.writerow({
                        'date': 'SUMMARY',
                        'amount_btc': 'TOTAL',
                        'amount_usd': '',
                        'amount_satoshi': '',
                        'from_addresses': '',
                        'transaction_id': '',
                        'type': ''
                    })
                    
                    # Total row
                    writer.writerow({
                        'date': '',
                        'amount_btc': f'{total_btc:.8f}',
                        'amount_usd': f'${total_usd:,.2f}',
                        'amount_satoshi': '',
                        'from_addresses': '',
                        'transaction_id': '',
                        'type': ''
                    })
            
            debug_print(f"Saved {len(transfers)} Bitcoin transfers to {filename}")
            
        except Exception as e:
            debug_print(f"Error saving Bitcoin transfers to CSV: {e}")
    
    def run(self):
        """
        Run the complete scraping process
        """
        try:
            # Get current BTC price first
            self.get_btc_price()
            
            # Scrape transfers
            token_transfers, bitcoin_transfers = self.scrape_address_transfers()
            
            debug_print("\n" + "="*60)
            debug_print("RESULTS SUMMARY")
            debug_print("="*60)
            
            if token_transfers:
                debug_print(f"\n✅ Found {len(token_transfers)} incoming TOKEN transfers:")
                for transfer in token_transfers:
                    debug_print(f"  {transfer['date']} - {transfer['amount']} {transfer['token_symbol']} from {transfer['from_address'][:20]}...")
                
                # Save token transfers to CSV
                self.save_to_csv(token_transfers)
                
                # Also append to the existing CSV if it exists
                if os.path.exists("incoming_token_transfers.csv"):
                    self.append_to_existing_csv(token_transfers)
            else:
                debug_print(f"\n❌ No incoming token transfers found for: {', '.join(self.target_tokens)}")
                debug_print("   Note: USDT exists on Bitcoin via Omni Layer, but USDC/DAI are primarily Ethereum tokens")
            
            if bitcoin_transfers:
                debug_print(f"\n📋 Found {len(bitcoin_transfers)} incoming BITCOIN transfers:")
                total_btc_received = sum(transfer['amount_btc'] for transfer in bitcoin_transfers)
                total_usd_received = sum(transfer['amount_usd'] for transfer in bitcoin_transfers)
                
                debug_print(f"   Total BTC received: {total_btc_received:.8f} BTC")
                debug_print(f"   Total USD value: ${total_usd_received:,.2f} USD")
                
                for transfer in bitcoin_transfers:
                    debug_print(f"  {transfer['date']} - {transfer['amount_btc']:.8f} BTC (${transfer['amount_usd']:,.2f}) from {len(transfer['from_addresses'])} address(es)")
                
                # Save Bitcoin transfers for reference
                self.save_bitcoin_transfers_to_csv(bitcoin_transfers)
            else:
                debug_print("\n📋 No incoming Bitcoin transfers found")
            
            debug_print("\n" + "="*60)
            debug_print("IMPORTANT NOTE:")
            debug_print("- USDT on Bitcoin exists through Omni Layer protocol")
            debug_print("- USDC and DAI are primarily Ethereum-based tokens")
            debug_print("- This address appears to have Bitcoin transactions but no target tokens")
            debug_print("- Check the generated CSV files for detailed transaction data")
            debug_print(f"- USD values calculated using current BTC price: ${self.btc_price_usd:,.2f}")
            debug_print("="*60)
                
        except Exception as e:
            debug_print(f"Error during scraping: {e}")
    
    def append_to_existing_csv(self, new_transfers):
        """
        Append new transfers to the existing CSV file
        """
        try:
            # Read existing data
            existing_df = pd.read_csv("incoming_token_transfers.csv")
            
            # Create DataFrame from new transfers
            new_df = pd.DataFrame(new_transfers)
            
            # Combine and remove duplicates based on transaction_id
            combined_df = pd.concat([existing_df, new_df], ignore_index=True)
            combined_df = combined_df.drop_duplicates(subset=['transaction_id'], keep='last')
            
            # Sort by date
            combined_df = combined_df.sort_values('date', ascending=False)
            
            # Save back to CSV
            combined_df.to_csv("incoming_token_transfers.csv", index=False)
            
            debug_print(f"Updated main CSV file with {len(new_transfers)} new transfers")
            
        except Exception as e:
            debug_print(f"Error updating existing CSV: {e}")

if __name__ == "__main__":
    # Check if address is provided as command line argument
    if len(sys.argv) > 1:
        target_address = sys.argv[1]
    else:
        target_address = "bc1qxm0m3g2k0lfj37slknha946hgk4aekhwc7dsj3"  # Default address
    
    scraper = BitcoinAddressScraper()
    scraper.target_address = target_address
    
    try:
        # Get current BTC price first
        scraper.get_btc_price()
        
        # Scrape transfers
        token_transfers, bitcoin_transfers = scraper.scrape_address_transfers()
        
        # Output JSON for service integration
        result = {
            "success": True,
            "address": target_address,
            "btc_price": scraper.btc_price_usd,
            "token_transfers": token_transfers,
            "bitcoin_transfers": bitcoin_transfers,
            "summary": {
                "token_count": len(token_transfers),
                "bitcoin_count": len(bitcoin_transfers),
                "total_btc_value": sum(transfer['amount_btc'] for transfer in bitcoin_transfers),
                "total_usd_value": sum(transfer['amount_usd'] for transfer in bitcoin_transfers)
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
