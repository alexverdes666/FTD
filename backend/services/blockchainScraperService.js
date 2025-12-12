const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const OurNetwork = require('../models/OurNetwork');
const BlockchainTransaction = require('../models/BlockchainTransaction');

const DEFAULT_BLOCKCHAIN_CRON_SCHEDULE = '0 3 * * *'; // Daily at 3:00 AM UTC
const BLOCKCHAIN_STARTUP_DELAY_MS = 60000; // 60 seconds (1 minute after server start)

class BlockchainScraperService {
  constructor() {
    if (BlockchainScraperService.instance) {
      return BlockchainScraperService.instance;
    }
    
    this.scraperStatus = {
      bitcoin: 'idle',
      ethereum: 'idle',
      tron: 'idle'
    };
    
    this.lastScrapeTime = {
      bitcoin: null,
      ethereum: null,
      tron: null
    };
    
    // Enhanced overall status tracking for async operations
    this.overallStatus = {
      state: 'idle', // idle, running, completed, failed
      startTime: null,
      endTime: null,
      totalNetworks: 0,
      networksProcessed: 0,
      currentNetwork: null,
      error: null,
      lastResults: null,
      progress: 0 // percentage (0-100)
    };
    
    this.pythonCommand = null;
    
    // Scheduling properties
    this.isScheduled = false;
    this.cronJob = null;
    this.cronSchedule = process.env.BLOCKCHAIN_SCRAPER_CRON_SCHEDULE || DEFAULT_BLOCKCHAIN_CRON_SCHEDULE;
    this.autoScrapeEnabled = process.env.BLOCKCHAIN_AUTO_SCRAPE_ENABLED !== 'false'; // Enabled by default
    
    console.log('🔗 Blockchain Scraper Service initialized');
    BlockchainScraperService.instance = this;
  }

  static getInstance() {
    if (!BlockchainScraperService.instance) {
      BlockchainScraperService.instance = new BlockchainScraperService();
    }
    return BlockchainScraperService.instance;
  }

  /**
   * Detect the correct Python command for the current platform
   */
  async detectPythonCommand() {
    if (this.pythonCommand) {
      return this.pythonCommand;
    }

    // First, let's check what files actually exist in common Python locations
    console.log('🔍 Checking Python installations...');
    const commonPaths = ['/usr/bin', '/usr/local/bin', '/bin'];
    for (const dir of commonPaths) {
      try {
        const files = fs.readdirSync(dir);
        const pythonFiles = files.filter(f => f.startsWith('python'));
        if (pythonFiles.length > 0) {
          console.log(`📁 Found Python-related files in ${dir}: ${pythonFiles.join(', ')}`);
        }
      } catch (error) {
        console.log(`📁 Could not read directory ${dir}: ${error.message}`);
      }
    }

    // Extended list of Python commands to try, including full paths
    const commands = process.platform === 'win32' 
      ? ['python', 'python3', 'py', 'C:\\Python3\\python.exe', 'C:\\Python39\\python.exe', 'C:\\Python310\\python.exe']
      : [
          'python3', 
          'python', 
          'py', 
          '/usr/bin/python3', 
          '/usr/local/bin/python3', 
          '/usr/bin/python', 
          '/usr/local/bin/python',
          '/opt/python/bin/python3',
          '/opt/python/bin/python'
        ];
    
    // Also check PATH environment variable for python executables
    const pathEnv = process.env.PATH || '';
    const pathDirs = pathEnv.split(process.platform === 'win32' ? ';' : ':');
    
    for (const dir of pathDirs) {
      if (dir.trim()) {
        commands.push(
          path.join(dir, 'python3'),
          path.join(dir, 'python'),
          path.join(dir, 'py')
        );
      }
    }
    
    console.log(`🐍 Attempting to detect Python command from ${commands.length} possible locations...`);
    
    for (const cmd of commands) {
      try {
        // First check if the file exists
        if (cmd.startsWith('/')) {
          try {
            await fs.promises.access(cmd, fs.constants.F_OK);
            console.log(`📄 File exists: ${cmd}`);
          } catch (err) {
            console.log(`📄 File not found: ${cmd}`);
            continue;
          }
        }
        
        await new Promise((resolve, reject) => {
          const testProcess = spawn(cmd, ['--version'], { 
            stdio: 'pipe',
            env: { ...process.env, PATH: process.env.PATH }
          });
          
          let output = '';
          testProcess.stdout.on('data', (data) => {
            output += data.toString();
          });
          testProcess.stderr.on('data', (data) => {
            output += data.toString();
          });
          
          testProcess.on('close', (code) => {
            if (code === 0) {
              console.log(`✅ Python version found: ${output.trim()}`);
              resolve();
            } else {
              reject(new Error(`Command failed with code ${code}`));
            }
          });
          
          testProcess.on('error', (error) => {
            reject(error);
          });
          
          // Add timeout to prevent hanging
          setTimeout(() => {
            testProcess.kill();
            reject(new Error('Command timed out'));
          }, 5000);
        });
        
        console.log(`✅ Using Python command: ${cmd}`);
        this.pythonCommand = cmd;
        return cmd;
      } catch (error) {
        console.log(`❌ Python command '${cmd}' not available: ${error.message}`);
        continue;
      }
    }
    
    // Enhanced error message with debugging info
    console.error('🚨 Python detection failed. Environment info:');
    console.error('Platform:', process.platform);
    console.error('Architecture:', process.arch);
    console.error('Node version:', process.version);
    console.error('PATH:', process.env.PATH);
    console.error('PWD:', process.cwd());
    
    // Additional debugging - check if any python-related processes are running
    try {
      const { exec } = require('child_process');
      exec('ps aux | grep python', (error, stdout, stderr) => {
        if (stdout) console.error('Python processes:', stdout);
      });
    } catch (err) {
      console.error('Could not check running processes');
    }
    
    throw new Error('No Python interpreter found. Please install Python and ensure it\'s in your PATH.');
  }

  /**
   * Get all active networks with wallet addresses
   */
  async getActiveNetworks() {
    try {
      const networks = await OurNetwork.find({ isActive: true });
      return networks.filter(network => {
        const wallets = network.cryptoWallets || {};
        
        // Check if any blockchain has non-empty wallet addresses
        const hasEthereumWallets = Array.isArray(wallets.ethereum) && 
          wallets.ethereum.some(addr => addr && addr.trim() !== '');
        const hasBitcoinWallets = Array.isArray(wallets.bitcoin) && 
          wallets.bitcoin.some(addr => addr && addr.trim() !== '');
        const hasTronWallets = Array.isArray(wallets.tron) && 
          wallets.tron.some(addr => addr && addr.trim() !== '');
        
        // Support backward compatibility with single addresses
        const hasLegacyEthereum = typeof wallets.ethereum === 'string' && wallets.ethereum.trim() !== '';
        const hasLegacyBitcoin = typeof wallets.bitcoin === 'string' && wallets.bitcoin.trim() !== '';
        const hasLegacyTron = typeof wallets.tron === 'string' && wallets.tron.trim() !== '';
        
        return hasEthereumWallets || hasBitcoinWallets || hasTronWallets ||
               hasLegacyEthereum || hasLegacyBitcoin || hasLegacyTron;
      });
    } catch (error) {
      console.error('Error fetching active networks:', error);
      throw error;
    }
  }

  /**
   * Run a scraper and return parsed JSON result
   */
  async runScraper(scriptName, address, extraArgs = []) {
    return new Promise(async (resolve, reject) => {
      try {
        const pythonCmd = await this.detectPythonCommand();
        const scriptPath = path.join(__dirname, '../Scrapers', scriptName);
        const args = [scriptPath, address, ...extraArgs];
        
        console.log(`🐍 Running Python scraper: ${pythonCmd} ${args.join(' ')}`);
        console.log(`📂 Script path: ${scriptPath}`);
        console.log(`📍 Working directory: ${path.dirname(scriptPath)}`);
        
        // Check if script file exists
        if (!fs.existsSync(scriptPath)) {
          reject(new Error(`Scraper script not found: ${scriptPath}`));
          return;
        }
        
        const pythonProcess = spawn(pythonCmd, args, {
          cwd: path.dirname(scriptPath),
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { 
            ...process.env, 
            PATH: process.env.PATH,
            PYTHONPATH: process.env.PYTHONPATH || '',
            PYTHONIOENCODING: 'utf-8'
          }
        });

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        pythonProcess.on('close', (code) => {
          console.log(`🐍 Python process exited with code: ${code}`);
          if (stderr.trim()) {
            console.log(`📝 Python stderr: ${stderr.trim()}`);
          }
          
          if (code === 0) {
            try {
              console.log(`📊 Python stdout: ${stdout.substring(0, 200)}...`);
              const result = JSON.parse(stdout);
              resolve(result);
            } catch (error) {
              console.error(`❌ Failed to parse JSON output: ${error.message}`);
              console.error(`📊 Raw output: ${stdout}`);
              reject(new Error(`Failed to parse JSON output: ${error.message}. Raw output: ${stdout.substring(0, 500)}`));
            }
          } else {
            const errorMsg = `Scraper failed with code ${code}. stderr: ${stderr}. stdout: ${stdout}`;
            console.error(`❌ ${errorMsg}`);
            reject(new Error(errorMsg));
          }
        });

        pythonProcess.on('error', (error) => {
          console.error(`❌ Failed to start Python process: ${error.message}`);
          reject(new Error(`Failed to start scraper: ${error.message}`));
        });
        
        // Add timeout to prevent hanging
        setTimeout(() => {
          pythonProcess.kill();
          reject(new Error(`Scraper timed out after 30 seconds`));
        }, 30000);
      
      } catch (error) {
        console.error(`❌ Error in runScraper: ${error.message}`);
        reject(new Error(`Failed to detect Python command: ${error.message}`));
      }
    });
  }

  /**
   * Convert scraper result to blockchain transaction format
   */
  convertToBlockchainTransaction(scraperResult, networkId, networkName, blockchain) {
    const transactions = [];
    
    console.log(`🔄 Converting ${blockchain} scraper result for network ${networkName}...`);
    console.log(`📊 Scraper result success: ${scraperResult.success}`);
    
    if (!scraperResult.success) {
      console.error(`❌ Scraper failed for ${blockchain}: ${scraperResult.error}`);
      return transactions;
    }

    let transfers = [];
    
    // Handle different response formats for different blockchains
    if (blockchain === 'bitcoin') {
      // Bitcoin scraper returns both token_transfers and bitcoin_transfers
      const tokenTransfers = scraperResult.token_transfers || [];
      const bitcoinTransfers = scraperResult.bitcoin_transfers || [];
      transfers = [...tokenTransfers, ...bitcoinTransfers];
      console.log(`📈 Bitcoin transfers found: ${tokenTransfers.length} token + ${bitcoinTransfers.length} bitcoin = ${transfers.length} total`);
    } else {
      // Ethereum and TRON use the 'transfers' field
      transfers = scraperResult.transfers || [];
      console.log(`📈 ${blockchain} transfers found: ${transfers.length}`);
      if (transfers.length > 0) {
        console.log(`📝 Sample transfer structure:`, JSON.stringify(transfers[0], null, 2));
      }
    }
      
      for (const transfer of transfers) {
      try {
        let txData = {
          network: networkId,
          networkName,
          blockchain,
          walletAddress: scraperResult.address,
          transferType: 'incoming',
          scraperInfo: {
            scrapedAt: new Date(),
            scraperVersion: '1.0.0',
            dataSource: this.getDataSource(blockchain)
          }
        };

        // Handle different blockchain formats
        if (blockchain === 'bitcoin') {
          if (transfer.token_symbol) {
            // Token transfer
            txData = {
              ...txData,
              transactionHash: transfer.transaction_id,
              transactionId: transfer.transaction_id,
              from: transfer.from_address,
              to: transfer.to_address || scraperResult.address,
              amount: parseFloat(transfer.amount) || 0,
              amountRaw: transfer.amount.toString(),
              token: {
                symbol: transfer.token_symbol,
                name: transfer.token_name || transfer.token_symbol,
                decimals: 8
              },
              timestamp: new Date(transfer.date),
              date: transfer.date.split(' ')[0],
              usdValue: parseFloat(transfer.amount) || 0 // Assuming stablecoin ≈ $1
            };
          } else {
            // Bitcoin transfer
            txData = {
              ...txData,
              transactionHash: transfer.transaction_id,
              transactionId: transfer.transaction_id,
              from: transfer.from_addresses ? transfer.from_addresses.join(', ') : '',
              to: scraperResult.address,
              amount: parseFloat(transfer.amount_btc) || 0,
              amountRaw: transfer.amount_satoshi.toString(),
              token: {
                symbol: 'BTC',
                name: 'Bitcoin',
                decimals: 8
              },
              timestamp: new Date(transfer.date),
              date: transfer.date.split(' ')[0],
              usdValue: parseFloat(transfer.amount_usd) || 0
            };
          }
        } else if (blockchain === 'ethereum') {
          // Add error checking for ethereum transfers
          if (!transfer['Transaction Hash'] || !transfer['From'] || !transfer['Amount'] || !transfer['Token'] || !transfer['Date']) {
            console.error('Missing required Ethereum transfer fields:', transfer);
            continue;
          }
          
          txData = {
            ...txData,
            transactionHash: transfer['Transaction Hash'],
            transactionId: transfer['Transaction Hash'],
            from: transfer['From'],
            to: scraperResult.address,
            amount: parseFloat(transfer['Amount'].replace(/,/g, '')) || 0,
            amountRaw: transfer['Amount'],
            token: {
              symbol: transfer['Token'],
              name: transfer['Token'],
              decimals: 18
            },
            timestamp: new Date(transfer['Date']),
            date: transfer['Date'].split(' ')[0],
            blockNumber: parseInt(transfer['Block Number']) || 0,
            usdValue: parseFloat(transfer['Amount'].replace(/,/g, '')) || 0 // Assuming stablecoin ≈ $1
          };
        } else if (blockchain === 'tron') {
          txData = {
            ...txData,
            transactionHash: transfer.transaction_id,
            transactionId: transfer.transaction_id,
            from: transfer.from_address,
            to: transfer.to_address,
            amount: parseFloat(transfer.amount) || 0,
            amountRaw: transfer.raw_amount.toString(),
            token: {
              symbol: transfer.token_symbol,
              name: transfer.token_name,
              decimals: transfer.token_decimals || 6
            },
            timestamp: new Date(transfer.date),
            date: transfer.date.split(' ')[0],
            blockNumber: parseInt(transfer.block_number) || 0,
            usdValue: parseFloat(transfer.amount) || 0 // Assuming stablecoin ≈ $1
          };
        }

        transactions.push(txData);
      } catch (error) {
        console.error('Error converting transaction:', error);
      }
    }

    return transactions;
  }

  getDataSource(blockchain) {
    switch (blockchain) {
      case 'bitcoin':
        return 'blockchain.info';
      case 'ethereum':
        return 'etherscan';
      case 'tron':
        return 'tronscan';
      default:
        return 'unknown';
    }
  }

  /**
   * Save transactions to database
   */
  async saveTransactions(transactions) {
    const savedTransactions = [];
    
    for (const txData of transactions) {
      try {
        // Check if transaction already exists
        const existingTx = await BlockchainTransaction.findOne({
          transactionHash: txData.transactionHash
        });
        
        if (!existingTx) {
          const transaction = new BlockchainTransaction(txData);
          await transaction.save();
          savedTransactions.push(transaction);
        }
      } catch (error) {
        console.error('Error saving transaction:', error);
      }
    }
    
    return savedTransactions;
  }

  /**
   * Run all scrapers for all networks
   */
  async runAllScrapers() {
    try {
      console.log('🚀 Starting blockchain scrapers for all networks...');
      
      const networks = await this.getActiveNetworks();
      
      // Initialize progress tracking
      this.overallStatus.totalNetworks = networks.length;
      this.overallStatus.networksProcessed = 0;
      
      const results = {
        bitcoin: [],
        ethereum: [],
        tron: [],
        summary: {
          networksScraped: 0,
          totalTransactions: 0,
          newTransactions: 0
        }
      };
      
      for (const network of networks) {
        // Update current network being processed
        this.overallStatus.currentNetwork = network.name;
        console.log(`📍 Processing network: ${network.name} (${this.overallStatus.networksProcessed + 1}/${this.overallStatus.totalNetworks})`);
        
        const { cryptoWallets } = network;
        
        // Helper function to get wallet addresses as array
        const getWalletArray = (wallet) => {
          if (Array.isArray(wallet)) return wallet.filter(addr => addr && addr.trim() !== '');
          return wallet && wallet.trim() !== '' ? [wallet] : [];
        };

        // Bitcoin scraper
        const bitcoinWallets = getWalletArray(cryptoWallets.bitcoin);
        if (bitcoinWallets.length > 0) {
          this.scraperStatus.bitcoin = 'running';
          for (const btcAddress of bitcoinWallets) {
            try {
              console.log(`Running Bitcoin scraper for address: ${btcAddress}`);
              const btcResult = await this.runScraper('btc_scraper.py', btcAddress);
              const btcTransactions = this.convertToBlockchainTransaction(btcResult, network._id, network.name, 'bitcoin');
              const savedBtc = await this.saveTransactions(btcTransactions);
              results.bitcoin.push(...savedBtc);
            } catch (error) {
              console.error(`Bitcoin scraper failed for address ${btcAddress} in network ${network.name}:`, error);
            }
          }
          this.scraperStatus.bitcoin = 'completed';
          this.lastScrapeTime.bitcoin = new Date();
        }
        
        // Ethereum scraper
        const ethereumWallets = getWalletArray(cryptoWallets.ethereum);
        if (ethereumWallets.length > 0) {
          this.scraperStatus.ethereum = 'running';
          const apiKey = process.env.ETHERSCAN_API_KEY || '1MBFZQA78GEHK1SV9M3WGKK39K9IS26ANX';
          for (const ethAddress of ethereumWallets) {
            try {
              console.log(`Running Ethereum scraper for address: ${ethAddress}`);
              const ethResult = await this.runScraper('eth_scraper.py', ethAddress, [apiKey]);
              const ethTransactions = this.convertToBlockchainTransaction(ethResult, network._id, network.name, 'ethereum');
              const savedEth = await this.saveTransactions(ethTransactions);
              results.ethereum.push(...savedEth);
            } catch (error) {
              console.error(`Ethereum scraper failed for address ${ethAddress} in network ${network.name}:`, error);
            }
          }
          this.scraperStatus.ethereum = 'completed';
          this.lastScrapeTime.ethereum = new Date();
        }
        
        // TRON scraper
        const tronWallets = getWalletArray(cryptoWallets.tron);
        if (tronWallets.length > 0) {
          this.scraperStatus.tron = 'running';
          for (const tronAddress of tronWallets) {
            try {
              console.log(`Running TRON scraper for address: ${tronAddress}`);
              const tronResult = await this.runScraper('tron_scraper.py', tronAddress);
              const tronTransactions = this.convertToBlockchainTransaction(tronResult, network._id, network.name, 'tron');
              const savedTron = await this.saveTransactions(tronTransactions);
              results.tron.push(...savedTron);
            } catch (error) {
              console.error(`TRON scraper failed for address ${tronAddress} in network ${network.name}:`, error);
            }
          }
          this.scraperStatus.tron = 'completed';
          this.lastScrapeTime.tron = new Date();
        }
        
        results.summary.networksScraped++;
        
        // Update progress after each network
        this.overallStatus.networksProcessed++;
        this.overallStatus.progress = Math.round((this.overallStatus.networksProcessed / this.overallStatus.totalNetworks) * 100);
        console.log(`✅ Completed network ${network.name} - Progress: ${this.overallStatus.progress}%`);
      }
      
      // Calculate summary
      results.summary.totalTransactions = 
        results.bitcoin.length + results.ethereum.length + results.tron.length;
      results.summary.newTransactions = results.summary.totalTransactions;
      
      // Calculate total USD value across all blockchains
      const totalUsdValue = [
        ...results.bitcoin,
        ...results.ethereum,
        ...results.tron
      ].reduce((sum, transaction) => {
        return sum + (parseFloat(transaction.usdValue) || 0);
      }, 0);
      
      results.summary.totalUsdValue = totalUsdValue;
      
      // Add breakdown by blockchain
      results.summary.breakdown = {
        bitcoin: {
          count: results.bitcoin.length,
          totalUsdValue: results.bitcoin.reduce((sum, tx) => sum + (parseFloat(tx.usdValue) || 0), 0)
        },
        ethereum: {
          count: results.ethereum.length,
          totalUsdValue: results.ethereum.reduce((sum, tx) => sum + (parseFloat(tx.usdValue) || 0), 0)
        },
        tron: {
          count: results.tron.length,
          totalUsdValue: results.tron.reduce((sum, tx) => sum + (parseFloat(tx.usdValue) || 0), 0)
        }
      };
      
      return results;
      
    } catch (error) {
      console.error('Error running blockchain scrapers:', error);
      throw error;
    }
  }

  /**
   * Start all scrapers asynchronously (non-blocking)
   * Returns immediately while scrapers run in background
   */
  startAllScrapersAsync() {
    // Check if already running
    if (this.overallStatus.state === 'running') {
      throw new Error('Scrapers are already running. Please wait for completion.');
    }

    // Reset and initialize status
    this.overallStatus = {
      state: 'running',
      startTime: new Date(),
      endTime: null,
      totalNetworks: 0,
      networksProcessed: 0,
      currentNetwork: null,
      error: null,
      lastResults: null,
      progress: 0
    };

    console.log('🚀 Starting blockchain scrapers asynchronously...');

    // Run scrapers in background (don't await)
    this.runAllScrapers()
      .then((results) => {
        // Update status on success
        this.overallStatus.state = 'completed';
        this.overallStatus.endTime = new Date();
        this.overallStatus.lastResults = results;
        this.overallStatus.currentNetwork = null;
        this.overallStatus.progress = 100;
        
        const duration = (this.overallStatus.endTime - this.overallStatus.startTime) / 1000;
        console.log(`✅ All scrapers completed successfully in ${duration.toFixed(1)}s`);
        console.log(`📊 Results: ${results.summary.newTransactions} new transactions from ${results.summary.networksScraped} networks`);
      })
      .catch((error) => {
        // Update status on error
        this.overallStatus.state = 'failed';
        this.overallStatus.endTime = new Date();
        this.overallStatus.error = error.message;
        this.overallStatus.currentNetwork = null;
        
        console.error('❌ Scrapers failed:', error);
      });

    // Return immediately with status
    return {
      success: true,
      message: 'Blockchain scrapers started successfully',
      status: this.getScraperStatus()
    };
  }

  /**
   * Initialize scheduled blockchain scraping
   * Runs daily at configured time (default: 3:00 AM UTC)
   */
  initializeScheduledScraping() {
    if (!this.autoScrapeEnabled) {
      console.log('⚠️ Blockchain auto-scraping is disabled via environment variable');
      return;
    }

    if (this.isScheduled) {
      console.warn('⚠️ Blockchain scraper scheduling already initialized. Skipping.');
      return;
    }

    // Schedule the recurring task
    this.cronJob = cron.schedule(
      this.cronSchedule,
      () => {
        console.log('📅 Scheduled blockchain scrape triggered');
        this._runScheduledScrape('Daily Cron');
      },
      {
        scheduled: true,
        timezone: 'UTC', // Explicitly set timezone for consistency
      }
    );

    this.isScheduled = true;
    console.log(`📅 Blockchain scraper scheduled with pattern: "${this.cronSchedule}" (UTC)`);
    console.log(`📅 Next blockchain scrape will run at: ${this._getNextScheduledTime()}`);

    // Optionally trigger on startup (after a delay)
    if (process.env.BLOCKCHAIN_SCRAPE_ON_STARTUP !== 'false') {
      console.log(`⏱️ Blockchain scraper will run ${BLOCKCHAIN_STARTUP_DELAY_MS / 1000}s after startup...`);
      setTimeout(() => {
        console.log('🚀 Running initial startup blockchain scrape...');
        this._runScheduledScrape('Initial Startup');
      }, BLOCKCHAIN_STARTUP_DELAY_MS);
    }
  }

  /**
   * Private helper to run scheduled scrape tasks
   * @private
   */
  _runScheduledScrape(taskName = 'Scheduled') {
    console.log(`🚀 Triggering ${taskName} blockchain scrape...`);
    try {
      this.startAllScrapersAsync();
    } catch (error) {
      console.error(`❌ ${taskName} blockchain scrape failed to start:`, error.message);
    }
  }

  /**
   * Get the next scheduled scrape time
   * @private
   */
  _getNextScheduledTime() {
    try {
      // Parse cron schedule to get next run time
      const cronParts = this.cronSchedule.split(' ');
      if (cronParts.length >= 2) {
        const [minute, hour] = cronParts;
        return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')} UTC daily`;
      }
      return 'See cron schedule: ' + this.cronSchedule;
    } catch (error) {
      return this.cronSchedule;
    }
  }

  /**
   * Stop scheduled scraping (useful for testing or manual control)
   */
  stopScheduledScraping() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.isScheduled = false;
      console.log('⏹️ Blockchain scraper scheduling stopped');
    }
  }

  /**
   * Check if Python environment is available
   */
  async checkPythonEnvironment() {
    try {
      await this.detectPythonCommand();
      return { available: true, error: null };
    } catch (error) {
      return { available: false, error: error.message };
    }
  }

  /**
   * Run scrapers for a specific network
   */
  async runNetworkScrapers(networkId) {
    try {
      console.log(`🚀 Starting blockchain scrapers for network ${networkId}...`);
      
      // Check Python environment first
      const pythonCheck = await this.checkPythonEnvironment();
      if (!pythonCheck.available) {
        console.error(`❌ Python environment not available: ${pythonCheck.error}`);
        return {
          bitcoin: [],
          ethereum: [],
          tron: [],
          summary: {
            networkId: networkId,
            networkName: 'Unknown',
            totalTransactions: 0,
            newTransactions: 0,
            error: `Python environment not available: ${pythonCheck.error}`
          }
        };
      }
      
      const network = await OurNetwork.findOne({ _id: networkId, isActive: true });
      if (!network) {
        throw new Error('Network not found or inactive');
      }
      
      const { cryptoWallets } = network;
      const results = {
        bitcoin: [],
        ethereum: [],
        tron: [],
        summary: {
          networkId: network._id,
          networkName: network.name,
          totalTransactions: 0,
          newTransactions: 0
        }
      };
      
      // Helper function to get wallet addresses as array
      const getWalletArray = (wallet) => {
        if (Array.isArray(wallet)) return wallet.filter(addr => addr && addr.trim() !== '');
        return wallet && wallet.trim() !== '' ? [wallet] : [];
      };

      // Bitcoin scraper
      const bitcoinWallets = getWalletArray(cryptoWallets.bitcoin);
      if (bitcoinWallets.length > 0) {
        console.log(`Running Bitcoin scraper for network ${network.name}...`);
        console.log(`🔗 Bitcoin wallet addresses: ${bitcoinWallets.join(', ')}`);
        for (const btcAddress of bitcoinWallets) {
          try {
            console.log(`  Scraping Bitcoin address: ${btcAddress}`);
            const btcResult = await this.runScraper('btc_scraper.py', btcAddress);
            const btcTransactions = this.convertToBlockchainTransaction(btcResult, network._id, network.name, 'bitcoin');
            const savedBtc = await this.saveTransactions(btcTransactions);
            results.bitcoin.push(...savedBtc);
          } catch (error) {
            console.error(`  ❌ Bitcoin scraper failed for address ${btcAddress}:`, error);
            if (!results.bitcoin.error) results.bitcoin.error = [];
            results.bitcoin.error.push(`Address ${btcAddress}: ${error.message}`);
          }
        }
      } else {
        console.log(`⚠️  No Bitcoin wallets configured for network ${network.name}`);
      }
      
      // Ethereum scraper
      const ethereumWallets = getWalletArray(cryptoWallets.ethereum);
      if (ethereumWallets.length > 0) {
        console.log(`Running Ethereum scraper for network ${network.name}...`);
        console.log(`🔗 Ethereum wallet addresses: ${ethereumWallets.join(', ')}`);
        const apiKey = process.env.ETHERSCAN_API_KEY || '1MBFZQA78GEHK1SV9M3WGKK39K9IS26ANX';
        console.log(`🔑 Using Etherscan API key: ${apiKey.substring(0, 10)}...`);
        for (const ethAddress of ethereumWallets) {
          try {
            console.log(`  Scraping Ethereum address: ${ethAddress}`);
            const ethResult = await this.runScraper('eth_scraper.py', ethAddress, [apiKey]);
            const ethTransactions = this.convertToBlockchainTransaction(ethResult, network._id, network.name, 'ethereum');
            const savedEth = await this.saveTransactions(ethTransactions);
            results.ethereum.push(...savedEth);
          } catch (error) {
            console.error(`  ❌ Ethereum scraper failed for address ${ethAddress}:`, error);
            if (!results.ethereum.error) results.ethereum.error = [];
            results.ethereum.error.push(`Address ${ethAddress}: ${error.message}`);
          }
        }
      } else {
        console.log(`⚠️  No Ethereum wallets configured for network ${network.name}`);
      }
      
      // TRON scraper
      const tronWallets = getWalletArray(cryptoWallets.tron);
      if (tronWallets.length > 0) {
        console.log(`Running TRON scraper for network ${network.name}...`);
        console.log(`🔗 TRON wallet addresses: ${tronWallets.join(', ')}`);
        for (const tronAddress of tronWallets) {
          try {
            console.log(`  Scraping TRON address: ${tronAddress}`);
            const tronResult = await this.runScraper('tron_scraper.py', tronAddress);
            const tronTransactions = this.convertToBlockchainTransaction(tronResult, network._id, network.name, 'tron');
            const savedTron = await this.saveTransactions(tronTransactions);
            results.tron.push(...savedTron);
          } catch (error) {
            console.error(`  ❌ TRON scraper failed for address ${tronAddress}:`, error);
            if (!results.tron.error) results.tron.error = [];
            results.tron.error.push(`Address ${tronAddress}: ${error.message}`);
          }
        }
      } else {
        console.log(`⚠️  No TRON wallets configured for network ${network.name}`);
      }
      
      // Calculate summary
      results.summary.totalTransactions = 
        results.bitcoin.length + results.ethereum.length + results.tron.length;
      results.summary.newTransactions = results.summary.totalTransactions;
      
      // Calculate total USD value across all blockchains for this network
      const totalUsdValue = [
        ...results.bitcoin,
        ...results.ethereum,
        ...results.tron
      ].reduce((sum, transaction) => {
        return sum + (parseFloat(transaction.usdValue) || 0);
      }, 0);
      
      results.summary.totalUsdValue = totalUsdValue;
      
      // Add breakdown by blockchain
      results.summary.breakdown = {
        bitcoin: {
          count: results.bitcoin.length,
          totalUsdValue: results.bitcoin.reduce((sum, tx) => sum + (parseFloat(tx.usdValue) || 0), 0),
          error: results.bitcoin.error
        },
        ethereum: {
          count: results.ethereum.length,
          totalUsdValue: results.ethereum.reduce((sum, tx) => sum + (parseFloat(tx.usdValue) || 0), 0),
          error: results.ethereum.error
        },
        tron: {
          count: results.tron.length,
          totalUsdValue: results.tron.reduce((sum, tx) => sum + (parseFloat(tx.usdValue) || 0), 0),
          error: results.tron.error
        }
      };
      
      return results;
      
    } catch (error) {
      console.error('Error running network scrapers:', error);
      throw error;
    }
  }

  /**
   * Get network-specific blockchain summary
   */
  async getNetworkSummary(networkId, days = 30, month = null, year = null) {
    try {
      const network = await OurNetwork.findOne({ _id: networkId, isActive: true });
      if (!network) {
        throw new Error('Network not found or inactive');
      }

      let query = { network: networkId };
      
      // Apply month/year filter if provided
      if (month !== null && year !== null) {
        const startDate = new Date(year, month - 1, 1); // Convert 1-based month to 0-based
        const endDate = new Date(year, month, 0, 23, 59, 59, 999); // Last day of the target month
        
        query.timestamp = { 
          $gte: startDate,
          $lte: endDate
        };
      }
      // Fall back to days filter if month/year not provided
      else if (days && days > 0) {
        const dateFilter = new Date();
        dateFilter.setDate(dateFilter.getDate() - days);
        query.timestamp = { $gte: dateFilter };
      }

      const transactions = await BlockchainTransaction.find(query).sort({ timestamp: -1 });

      // Helper function to get wallet statistics per address
      const getWalletStats = (blockchainTransactions, walletAddresses) => {
        // Find transactions with matching wallet addresses
        let matchedTransactions = [];
        const walletStats = [];

        walletAddresses.forEach(address => {
          const walletTransactions = blockchainTransactions.filter(tx => tx.walletAddress === address);
          const walletUsdValue = walletTransactions.reduce((sum, tx) => sum + (parseFloat(tx.usdValue) || 0), 0);
          
          matchedTransactions.push(...walletTransactions);
          
          walletStats.push({
            address: address,
            count: walletTransactions.length,
            totalUsdValue: walletUsdValue,
            recentTransactions: walletTransactions.slice(0, 5) // Show 5 recent transactions per wallet
          });
        });

        // Find unmatched transactions (transactions that don't match any wallet address)
        const unmatchedTransactions = blockchainTransactions.filter(tx => 
          !walletAddresses.includes(tx.walletAddress)
        );

      

        // Sort wallets by total USD value (descending)
        walletStats.sort((a, b) => b.totalUsdValue - a.totalUsdValue);

        const stats = {
          total: {
            count: matchedTransactions.length, // Only count matched transactions
            totalUsdValue: matchedTransactions.reduce((sum, tx) => sum + (parseFloat(tx.usdValue) || 0), 0),
            // Debug info
            unmatchedTransactions: unmatchedTransactions.length,
            unmatchedValue: unmatchedTransactions.reduce((sum, tx) => sum + (parseFloat(tx.usdValue) || 0), 0)
          },
          wallets: walletStats
        };

        return stats;
      };

      // Helper function to get wallet addresses as array (with backward compatibility)
      const getWalletArray = (wallet) => {
        if (Array.isArray(wallet)) return wallet.filter(addr => addr && addr.trim() !== '');
        return wallet && wallet.trim() !== '' ? [wallet] : [];
      };

      // Get wallet addresses for each blockchain
      const ethereumWallets = getWalletArray(network.cryptoWallets?.ethereum);
      const bitcoinWallets = getWalletArray(network.cryptoWallets?.bitcoin);
      const tronWallets = getWalletArray(network.cryptoWallets?.tron);

      // Filter transactions by blockchain
      const bitcoinTransactions = transactions.filter(tx => tx.blockchain === 'bitcoin');
      const ethereumTransactions = transactions.filter(tx => tx.blockchain === 'ethereum');
      const tronTransactions = transactions.filter(tx => tx.blockchain === 'tron');

      // Calculate breakdown stats
      const bitcoinStats = bitcoinWallets.length > 0 ? getWalletStats(bitcoinTransactions, bitcoinWallets) : {
        total: { count: 0, totalUsdValue: 0 },
        wallets: []
      };
      const ethereumStats = ethereumWallets.length > 0 ? getWalletStats(ethereumTransactions, ethereumWallets) : {
        total: { count: 0, totalUsdValue: 0 },
        wallets: []
      };
      const tronStats = tronWallets.length > 0 ? getWalletStats(tronTransactions, tronWallets) : {
        total: { count: 0, totalUsdValue: 0 },
        wallets: []
      };

      // Calculate correct total USD value from individual wallet sums (instead of all transactions)
      // This ensures the total matches the sum of individual wallets
      const calculatedTotalUsdValue = 
        bitcoinStats.total.totalUsdValue + 
        ethereumStats.total.totalUsdValue + 
        tronStats.total.totalUsdValue;

      // For debugging: calculate both methods to compare
      const allTransactionsTotalValue = transactions.reduce((sum, tx) => sum + (parseFloat(tx.usdValue) || 0), 0);
      
      // USD value discrepancy is tracked but no longer logged
      // if (Math.abs(calculatedTotalUsdValue - allTransactionsTotalValue) > 0.01) {
      //   console.warn(`[${network.name}] USD Value Discrepancy:`, {
      //     calculatedFromWallets: calculatedTotalUsdValue,
      //     allTransactionsTotal: allTransactionsTotalValue,
      //     difference: allTransactionsTotalValue - calculatedTotalUsdValue,
      //     bitcoinTotal: bitcoinStats.total.totalUsdValue,
      //     ethereumTotal: ethereumStats.total.totalUsdValue,
      //     tronTotal: tronStats.total.totalUsdValue,
      //     totalTransactions: transactions.length,
      //     transactionsWithoutWalletAddress: transactions.filter(tx => !tx.walletAddress || tx.walletAddress.trim() === '').length
      //   });
      // }

      const summary = {
        networkId: network._id,
        networkName: network.name,
        totalTransactions: transactions.length,
        totalUsdValue: calculatedTotalUsdValue, // Use calculated total instead of raw sum
        breakdown: {
          bitcoin: bitcoinStats,
          ethereum: ethereumStats,
          tron: tronStats
        },
        // Summary of all wallets across blockchains
        walletSummary: {
          totalWallets: ethereumWallets.length + bitcoinWallets.length + tronWallets.length,
          ethereum: ethereumWallets.length,
          bitcoin: bitcoinWallets.length,
          tron: tronWallets.length
        },
        recentTransactions: transactions.slice(0, 10)
      };

      return summary;
    } catch (error) {
      console.error('Error getting network summary:', error);
      throw error;
    }
  }

  /**
   * Get overall summary for all networks - using corrected calculation method
   */
  async getOverallSummary(days = 30, month = null, year = null) {
    try {
      // Build date filter query
      let dateQuery = {};
      if (month !== null && year !== null) {
        const startDate = new Date(year, month - 1, 1); // Convert 1-based month to 0-based
        const endDate = new Date(year, month, 0, 23, 59, 59, 999); // Last day of the target month
        
        dateQuery = { 
          $gte: startDate,
          $lte: endDate
        };
      } else if (days && days > 0) {
        const dateFilter = new Date();
        dateFilter.setDate(dateFilter.getDate() - days);
        dateQuery = { $gte: dateFilter };
      }

      // Note: dateQuery is not used in getOverallSummary because we call getNetworkSummary 
      // which handles the filtering. Removed unused transactionQuery code.

      // Get all active networks and their summaries using the corrected method
      const networks = await OurNetwork.find({ isActive: true });
      
      let totalCryptoValue = 0;
      let totalTransactionCount = 0;
      let allNetworkDetails = [];
      
      const breakdown = {
        bitcoin: { count: 0, totalUsdValue: 0, networksWithWallets: 0 },
        ethereum: { count: 0, totalUsdValue: 0, networksWithWallets: 0 },
        tron: { count: 0, totalUsdValue: 0, networksWithWallets: 0 }
      };

      // Calculate summaries for each network using the corrected method
      for (const network of networks) {
        try {
          const networkSummary = await this.getNetworkSummary(
            network._id, 
            days, 
            month, 
            year
          );
          
          totalCryptoValue += networkSummary.totalUsdValue || 0;
          totalTransactionCount += networkSummary.totalTransactions || 0;
          
          // Add to breakdown by blockchain
          if (networkSummary.breakdown) {
            if (networkSummary.breakdown.bitcoin.total.totalUsdValue > 0) {
              breakdown.bitcoin.count += networkSummary.breakdown.bitcoin.total.count;
              breakdown.bitcoin.totalUsdValue += networkSummary.breakdown.bitcoin.total.totalUsdValue;
              breakdown.bitcoin.networksWithWallets += 1;
            }
            
            if (networkSummary.breakdown.ethereum.total.totalUsdValue > 0) {
              breakdown.ethereum.count += networkSummary.breakdown.ethereum.total.count;
              breakdown.ethereum.totalUsdValue += networkSummary.breakdown.ethereum.total.totalUsdValue;
              breakdown.ethereum.networksWithWallets += 1;
            }
            
            if (networkSummary.breakdown.tron.total.totalUsdValue > 0) {
              breakdown.tron.count += networkSummary.breakdown.tron.total.count;
              breakdown.tron.totalUsdValue += networkSummary.breakdown.tron.total.totalUsdValue;
              breakdown.tron.networksWithWallets += 1;
            }
          }
          
          // Add network details for reference
          allNetworkDetails.push({
            networkId: network._id,
            networkName: network.name,
            totalUsdValue: networkSummary.totalUsdValue || 0,
            totalTransactions: networkSummary.totalTransactions || 0,
            walletCount: networkSummary.walletSummary?.totalWallets || 0
          });
          
        } catch (error) {
          console.warn(`Failed to get summary for network ${network.name}:`, error.message);
        }
      }

      // Get recent transactions for display (limit to recent ones across all networks)
      const recentTransactions = await BlockchainTransaction.find(
        Object.keys(dateQuery).length > 0 ? { timestamp: dateQuery } : {}
      )
      .sort({ timestamp: -1 })
      .limit(20);

      const summary = {
        totalNetworks: networks.length,
        activeNetworksWithWallets: allNetworkDetails.filter(n => n.totalUsdValue > 0).length,
        totalTransactions: totalTransactionCount,
        totalUsdValue: totalCryptoValue, // This now uses the corrected calculation method
        breakdown,
        networkDetails: allNetworkDetails.sort((a, b) => b.totalUsdValue - a.totalUsdValue), // Sort by value
        recentTransactions: recentTransactions.slice(0, 10),
        periodInfo: {
          days: days,
          month: month,
          year: year,
          isMonthFilter: month !== null && year !== null,
          monthName: month && year ? new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long' }) : null
        }
      };

      return { summary };
    } catch (error) {
      console.error('Error getting overall summary:', error);
      throw error;
    }
  }

  /**
   * Get scraper status
   */
  getScraperStatus() {
    return {
      status: this.scraperStatus,
      lastScrapeTime: this.lastScrapeTime,
      isRunning: Object.values(this.scraperStatus).some(status => status === 'running') || this.overallStatus.state === 'running',
      // Enhanced overall status
      overall: {
        state: this.overallStatus.state,
        startTime: this.overallStatus.startTime,
        endTime: this.overallStatus.endTime,
        totalNetworks: this.overallStatus.totalNetworks,
        networksProcessed: this.overallStatus.networksProcessed,
        currentNetwork: this.overallStatus.currentNetwork,
        progress: this.overallStatus.progress,
        error: this.overallStatus.error,
        lastResults: this.overallStatus.lastResults
      }
    };
  }

  /**
   * Get recent transactions for all networks
   */
  async getRecentTransactions(limit = 50) {
    try {
      return await BlockchainTransaction.find({
        transferType: 'incoming'
      })
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('network', 'name');
    } catch (error) {
      console.error('Error fetching recent transactions:', error);
      throw error;
    }
  }

  /**
   * Get total USD value for all networks assigned to an affiliate manager
   */
  async getAffiliateManagerTotalValue(affiliateManagerId, options = {}) {
    try {
      // Get all networks assigned to this affiliate manager
      const networks = await OurNetwork.find({
        assignedAffiliateManager: affiliateManagerId,
        isActive: true
      });

      if (networks.length === 0) {
        return {
          totalUsdValue: 0,
          networksCount: 0,
          breakdown: {
            bitcoin: { count: 0, totalUsdValue: 0 },
            ethereum: { count: 0, totalUsdValue: 0 },
            tron: { count: 0, totalUsdValue: 0 }
          },
          networkDetails: []
        };
      }

      const networkIds = networks.map(network => network._id);
      let query = { 
        network: { $in: networkIds },
        transferType: 'incoming'
      };
      
      // Apply date filter based on month/year or date range
      if (options.month && options.year) {
        // Filter for specific month/year
        const startDate = new Date(parseInt(options.year), parseInt(options.month) - 1, 1);
        const endDate = new Date(parseInt(options.year), parseInt(options.month), 0, 23, 59, 59, 999);
        query.timestamp = { $gte: startDate, $lte: endDate };
      } else if (options.startDate && options.endDate) {
        // Filter for specific date range
        query.timestamp = { $gte: new Date(options.startDate), $lte: new Date(options.endDate) };
      }

      const transactions = await BlockchainTransaction.find(query).sort({ timestamp: -1 });

      const totalUsdValue = transactions.reduce((sum, tx) => sum + (parseFloat(tx.usdValue) || 0), 0);

      // Calculate breakdown by blockchain
      const breakdown = {
        bitcoin: {
          count: transactions.filter(tx => tx.blockchain === 'bitcoin').length,
          totalUsdValue: transactions
            .filter(tx => tx.blockchain === 'bitcoin')
            .reduce((sum, tx) => sum + (parseFloat(tx.usdValue) || 0), 0)
        },
        ethereum: {
          count: transactions.filter(tx => tx.blockchain === 'ethereum').length,
          totalUsdValue: transactions
            .filter(tx => tx.blockchain === 'ethereum')
            .reduce((sum, tx) => sum + (parseFloat(tx.usdValue) || 0), 0)
        },
        tron: {
          count: transactions.filter(tx => tx.blockchain === 'tron').length,
          totalUsdValue: transactions
            .filter(tx => tx.blockchain === 'tron')
            .reduce((sum, tx) => sum + (parseFloat(tx.usdValue) || 0), 0)
        }
      };

      // Calculate per-network details
      const networkDetails = networks.map(network => {
        const networkTransactions = transactions.filter(tx => tx.network.toString() === network._id.toString());
        const networkValue = networkTransactions.reduce((sum, tx) => sum + (parseFloat(tx.usdValue) || 0), 0);
        
        return {
          networkId: network._id,
          networkName: network.name,
          totalUsdValue: networkValue,
          transactionCount: networkTransactions.length,
          breakdown: {
            bitcoin: {
              count: networkTransactions.filter(tx => tx.blockchain === 'bitcoin').length,
              totalUsdValue: networkTransactions
                .filter(tx => tx.blockchain === 'bitcoin')
                .reduce((sum, tx) => sum + (parseFloat(tx.usdValue) || 0), 0),
              walletAddress: network.cryptoWallets?.bitcoin || null
            },
            ethereum: {
              count: networkTransactions.filter(tx => tx.blockchain === 'ethereum').length,
              totalUsdValue: networkTransactions
                .filter(tx => tx.blockchain === 'ethereum')
                .reduce((sum, tx) => sum + (parseFloat(tx.usdValue) || 0), 0),
              walletAddress: network.cryptoWallets?.ethereum || null
            },
            tron: {
              count: networkTransactions.filter(tx => tx.blockchain === 'tron').length,
              totalUsdValue: networkTransactions
                .filter(tx => tx.blockchain === 'tron')
                .reduce((sum, tx) => sum + (parseFloat(tx.usdValue) || 0), 0),
              walletAddress: network.cryptoWallets?.tron || null
            }
          }
        };
      });

      return {
        totalUsdValue,
        networksCount: networks.length,
        breakdown,
        networkDetails,
        totalTransactions: transactions.length
      };
    } catch (error) {
      console.error('Error calculating affiliate manager total value:', error);
      throw error;
    }
  }


}

module.exports = BlockchainScraperService; 