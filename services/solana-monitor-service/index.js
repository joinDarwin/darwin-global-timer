const express = require('express');
const { Connection, PublicKey } = require('@solana/web3.js');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Get token address from environment or use default
const getTokenMintAddress = () => {
  return process.env.TOKEN_ADDRESS || '9VxExA1iRPbuLLdSJ2rB3nyBxsyLReT4aqzZBMaBaY1p';
};

// Get Helius API key from environment variables
const getHeliusApiKey = () => {
  if (process.env.HELIUS_API_KEY) {
    return process.env.HELIUS_API_KEY;
  }
  if (process.env.NEXT_PUBLIC_HELIUS_API_KEY) {
    return process.env.NEXT_PUBLIC_HELIUS_API_KEY;
  }
  console.warn('⚠️ No Helius API key found, using demo key');
  return 'demo';
};

const TOKEN_MINT_ADDRESS = getTokenMintAddress();
const heliusApiKey = getHeliusApiKey();

// Multiple RPC endpoints for better reliability
const RPC_ENDPOINTS = [
  `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`,
  'https://api.mainnet-beta.solana.com',
  'https://solana-api.projectserum.com',
  'https://rpc.ankr.com/solana',
  'https://solana-mainnet.g.alchemy.com/v2/demo'
];

// Known DEX Program IDs on Solana
const DEX_PROGRAM_IDS = {
  RAYDIUM_AMM: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  RAYDIUM_CPMM: 'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C',
  JUPITER_V6: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  JUPITER_V4: 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',
  ORCA_WHIRLPOOL: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  SERUM_DEX: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
  OPENBOOK: 'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX',
  METEORA: 'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB',
  LIFINITY: 'LiFiDZ5VCEYF7QdM3gpn5h2cRcJCVTtZn4RUHhBY2Uy',
  ALDRIN: 'AMM55ShdkoGRB5jVYPjWJkYyQN6hB4Q3CEGQfeo7Ris',
  CREMA: '6MLxLqiXaaSUpkgMnWDTuejNZEz3kE7k2woyHGVFw319',
  STEPN: 'Dooar9JkhdZ7J3LHNH9fawoEWQyCJ6Uogp4v4eJp7fQm',
  SABER: 'SSwpkEEcfU9fz4L1vA1Lq6sWrP6Wm2pTzKWBz9eC6CN',
  MERCURIAL: 'MERLuDFBMmsHnsBPZw2sDQZHvXFMwp8EdjudcU2HKky',
  CYKURA: 'cysPXAjehMpVKUapzbMCCnpFxUFFryEWEaLgnb9NrR8',
  INVARIANT: 'HyaB3W9q6XdA5xwpU4XnSZV94htfmbmqJXZcEbRaJutt',
  RAYDIUM_CLMM: 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK',
  RAYDIUM_CONCENTRATED: 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK'
};

// Solana Monitor Service Class
class SolanaMonitorService {
  constructor() {
    this.connection = null;
    this.tokenMintPubkey = new PublicKey(TOKEN_MINT_ADDRESS);
    this.lastCheckedSignature = null;
    this.onSwapDetected = null;
    this.lastTrade = null;
    this.rpcIndex = 0;
    this.isMonitoring = false;
    this.pollInterval = parseInt(process.env.SOLANA_POLLING_INTERVAL || '60000'); // Start with 60 seconds
    this.consecutiveErrors = 0;
    this.lastSuccessfulCheck = 0;
    this.signatureCache = new Set();
    this.maxCacheSize = 1000;
    this.webhookMode = process.env.HELIUS_WEBHOOK_MODE === 'true';
    this.webhookUrl = process.env.HELIUS_WEBHOOK_URL || '';
    this.timerServiceUrl = process.env.TIMER_SERVICE_URL || 'http://localhost:3002';
    
    this.initializeConnection();
  }

  initializeConnection() {
    const rpcUrl = RPC_ENDPOINTS[this.rpcIndex];
    console.log(`🔗 Using RPC endpoint: ${rpcUrl}`);
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  async switchRpcEndpoint() {
    this.rpcIndex = (this.rpcIndex + 1) % RPC_ENDPOINTS.length;
    console.log(`🔄 Switching to RPC endpoint: ${RPC_ENDPOINTS[this.rpcIndex]}`);
    this.initializeConnection();
  }

  setSwapCallback(callback) {
    this.onSwapDetected = callback;
  }

  updateTokenAddress(newTokenAddress) {
    console.log(`🔄 Updating token address: ${TOKEN_MINT_ADDRESS} → ${newTokenAddress}`);
    this.tokenMintPubkey = new PublicKey(newTokenAddress);
    this.lastCheckedSignature = null;
    this.signatureCache.clear();
  }

  setPollingSpeed(mode) {
    const intervals = {
      conservative: { min: 60000, max: 300000, start: 120000 },
      balanced: { min: 30000, max: 120000, start: 60000 },
      aggressive: { min: 15000, max: 60000, start: 30000 },
      ultra: { min: 10000, max: 30000, start: 15000 }
    };
    
    const config = intervals[mode];
    this.pollInterval = config.start;
    
    console.log(`⚡ Polling speed set to ${mode}: ${config.start / 1000}s`);
  }

  async startMonitoring() {
    console.log('🚀 Starting Solana token swap monitoring...');
    console.log('📍 Monitoring token mint:', TOKEN_MINT_ADDRESS);
    console.log('🔗 RPC URL:', RPC_ENDPOINTS[this.rpcIndex]);
    
    this.isMonitoring = true;
    
    if (this.webhookMode && this.webhookUrl) {
      console.log('🎣 Using webhook mode for real-time notifications');
      await this.setupWebhook();
    } else {
      console.log(`⏱️ Using polling mode with interval: ${this.pollInterval / 1000}s`);
    }
    
    // Start polling for new transactions
    this.pollForNewTransactions();
  }

  async setupWebhook() {
    try {
      if (heliusApiKey === 'demo') {
        console.log('⚠️ Cannot setup webhook with demo API key');
        return;
      }

      const webhookData = {
        webhookURL: this.webhookUrl,
        transactionTypes: ['Any'],
        accountAddresses: [TOKEN_MINT_ADDRESS],
        webhookType: 'enhanced'
      };

      const response = await fetch(`https://api.helius.xyz/v0/webhooks?api-key=${heliusApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Webhook setup successful:', result.webhookID);
        console.log('🎣 Real-time notifications enabled - no more polling needed!');
      } else {
        console.log('❌ Webhook setup failed, falling back to polling');
        this.webhookMode = false;
      }
    } catch (error) {
      console.error('❌ Error setting up webhook:', error);
      console.log('🔄 Falling back to polling mode');
      this.webhookMode = false;
    }
  }

  async pollForNewTransactions() {
    if (!this.isMonitoring) {
      console.log('🛑 Monitoring stopped, exiting poll loop');
      return;
    }

    try {
      console.log(`🔍 Polling for new transactions (interval: ${this.pollInterval / 1000}s)...`);
      
      const tokenSignatures = await this.connection.getSignaturesForAddress(this.tokenMintPubkey, {
        limit: 5
      });
      
      console.log(`📊 Found ${tokenSignatures.length} recent transactions for token`);
      
      if (tokenSignatures.length === 0) {
        console.log('📭 No recent transactions found');
        this.consecutiveErrors = 0;
        this.lastSuccessfulCheck = Date.now();
        setTimeout(() => this.pollForNewTransactions(), this.pollInterval);
        return;
      }

      // Check only new signatures (not in cache)
      const newSignatures = tokenSignatures
        .map(sig => sig.signature)
        .filter(sig => !this.signatureCache.has(sig))
        .slice(0, 3);

      console.log(`🔎 Checking ${newSignatures.length} new transactions`);

      let foundTrade = false;
      for (const signature of newSignatures) {
        this.signatureCache.add(signature);
        if (this.signatureCache.size > this.maxCacheSize) {
          const oldestEntries = Array.from(this.signatureCache).slice(0, 100);
          oldestEntries.forEach(entry => this.signatureCache.delete(entry));
        }

        try {
          const tradeInfo = await this.analyzeTransaction(signature);
          if (tradeInfo) {
            console.log('✅ Token trade detected!', tradeInfo);
            this.lastTrade = tradeInfo;
            
            // Notify timer service
            await this.notifyTimerService(tradeInfo);
            
            if (this.onSwapDetected) {
              this.onSwapDetected(tradeInfo);
            }
            
            foundTrade = true;
            break;
          }
        } catch (txError) {
          console.log(`⚠️ Error analyzing transaction ${signature}:`, txError.message);
        }
      }

      // Update last checked signature
      if (tokenSignatures.length > 0) {
        this.lastCheckedSignature = tokenSignatures[0].signature;
      }

      // Reset error counter on success
      this.consecutiveErrors = 0;
      this.lastSuccessfulCheck = Date.now();

    } catch (error) {
      console.error('❌ Error polling for transactions:', error);
      this.consecutiveErrors++;
      
      const errorMessage = error.message || String(error);
      if (errorMessage.includes('403') || errorMessage.includes('rate limit') || errorMessage.includes('forbidden')) {
        console.log('🔄 RPC access issue detected, switching endpoint...');
        await this.switchRpcEndpoint();
      }
    }

    // Continue polling with interval
    setTimeout(() => this.pollForNewTransactions(), this.pollInterval);
  }

  async analyzeTransaction(signature) {
    try {
      console.log(`🔍 Analyzing transaction: ${signature}`);
      const transaction = await this.connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0
      });

      if (!transaction || !transaction.meta || !transaction.transaction) {
        return null;
      }

      // Check if transaction involves our token
      const preBalances = transaction.meta.preTokenBalances || [];
      const postBalances = transaction.meta.postTokenBalances || [];

      const hasOurToken = [...preBalances, ...postBalances].some(
        balance => balance.mint === TOKEN_MINT_ADDRESS
      );

      if (!hasOurToken) {
        return null;
      }

      // Check if transaction involves known DEX programs
      const message = transaction.transaction.message;
      const programIds = message.accountKeys.map(key => key.toString());
      const instructionProgramIds = message.instructions.map(ix => ix.programId.toString());
      
      const allProgramIds = [...programIds, ...instructionProgramIds];
      const hasDexProgram = allProgramIds.some(programId => 
        Object.values(DEX_PROGRAM_IDS).includes(programId)
      );

      if (!hasDexProgram) {
        return null;
      }

      // Analyze token balance changes
      const tokenBalanceChanges = this.calculateTokenBalanceChanges(preBalances, postBalances);
      const ourTokenChanges = tokenBalanceChanges.filter(change => change.mint === TOKEN_MINT_ADDRESS);
      
      if (ourTokenChanges.length === 0) {
        return null;
      }

      // Check if this is a genuine buy/sell transaction
      const tradeInfo = this.isBuyOrSellTransaction(transaction, ourTokenChanges, signature);
      
      return tradeInfo;

    } catch (error) {
      console.error('❌ Error analyzing transaction:', error);
      return null;
    }
  }

  isBuyOrSellTransaction(transaction, ourTokenChanges, signature) {
    try {
      const ourTokenChange = ourTokenChanges[0];
      const amount = Math.abs(ourTokenChange.change);
      
      const isBuy = ourTokenChange.change < 0;
      const type = isBuy ? 'buy' : 'sell';

      // Identify which DEX was used
      const message = transaction.transaction.message;
      const programIds = message.accountKeys.map(key => key.toString());
      
      let dex = 'Unknown';
      for (const [dexName, programId] of Object.entries(DEX_PROGRAM_IDS)) {
        if (programIds.includes(programId)) {
          dex = dexName;
          break;
        }
      }

      // Extract buyer/seller account (first account is typically the transaction signer)
      const buyer = message.accountKeys[0] ? message.accountKeys[0].toString() : null;

      // Only consider significant trades
      if (amount < 0.001) {
        return null;
      }

      return { 
        type, 
        amount, 
        dex, 
        signature,
        timestamp: Date.now(),
        buyer
      };

    } catch (error) {
      console.error('Error determining buy/sell:', error);
      return null;
    }
  }

  calculateTokenBalanceChanges(preBalances, postBalances) {
    const changes = [];
    
    const preMap = new Map();
    const postMap = new Map();

    preBalances.forEach(balance => {
      if (balance.mint) {
        preMap.set(balance.mint, balance.uiTokenAmount?.uiAmount || 0);
      }
    });

    postBalances.forEach(balance => {
      if (balance.mint) {
        postMap.set(balance.mint, balance.uiTokenAmount?.uiAmount || 0);
      }
    });

    const allMints = new Set([...preMap.keys(), ...postMap.keys()]);
    
    allMints.forEach(mint => {
      const preAmount = preMap.get(mint) || 0;
      const postAmount = postMap.get(mint) || 0;
      const change = postAmount - preAmount;
      
      if (Math.abs(change) > 0.000001) {
        changes.push({ mint, change });
      }
    });

    return changes;
  }

  async notifyTimerService(tradeInfo) {
    try {
      const response = await fetch(`${this.timerServiceUrl}/api/trade-detected`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tradeInfo })
      });

      if (response.ok) {
        console.log('✅ Timer service notified of trade');
      } else {
        console.error('❌ Failed to notify timer service:', response.status);
      }
    } catch (error) {
      console.error('❌ Error notifying timer service:', error);
    }
  }

  stopMonitoring() {
    console.log('🛑 Stopping Solana token swap monitoring...');
    this.isMonitoring = false;
  }

  getCostStats() {
    const mode = this.getCurrentMode();
    const bounds = this.getModeBounds(mode);
    const currentCost = this.estimateCostPerHour(this.pollInterval);
    const maxCost = this.estimateCostPerHour(bounds.min);
    const minCost = this.estimateCostPerHour(bounds.max);
    
    return {
      mode,
      currentInterval: this.pollInterval / 1000,
      currentCost,
      minCost,
      maxCost,
      range: `${bounds.min / 1000}s - ${bounds.max / 1000}s`,
      lastTrade: this.lastTrade ? new Date(this.lastTrade.timestamp).toISOString() : null,
      consecutiveErrors: this.consecutiveErrors
    };
  }

  getCurrentMode() {
    if (this.pollInterval <= 15000) return 'ultra';
    if (this.pollInterval <= 30000) return 'aggressive';
    if (this.pollInterval <= 60000) return 'balanced';
    return 'conservative';
  }

  getModeBounds(mode) {
    const intervals = {
      conservative: { min: 60000, max: 300000 },
      balanced: { min: 30000, max: 120000 },
      aggressive: { min: 15000, max: 60000 },
      ultra: { min: 10000, max: 30000 }
    };
    return intervals[mode] || intervals.balanced;
  }

  estimateCostPerHour(minInterval) {
    const callsPerPoll = 4;
    const pollsPerHour = 3600000 / minInterval;
    return Math.round(pollsPerHour * callsPerPoll);
  }
}

// Initialize Solana monitor service
const solanaMonitor = new SolanaMonitorService();

// API Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'solana-monitor-service',
    tokenAddress: TOKEN_MINT_ADDRESS,
    isMonitoring: solanaMonitor.isMonitoring,
    webhookMode: solanaMonitor.webhookMode
  });
});

app.get('/api/monitor/stats', (req, res) => {
  try {
    const stats = solanaMonitor.getCostStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error getting monitor stats:', error);
    res.status(500).json({ error: 'Failed to get monitor stats' });
  }
});

app.post('/api/monitor/start', (req, res) => {
  try {
    solanaMonitor.startMonitoring();
    res.json({ success: true, message: 'Monitoring started' });
  } catch (error) {
    console.error('Error starting monitoring:', error);
    res.status(500).json({ error: 'Failed to start monitoring' });
  }
});

app.post('/api/monitor/stop', (req, res) => {
  try {
    solanaMonitor.stopMonitoring();
    res.json({ success: true, message: 'Monitoring stopped' });
  } catch (error) {
    console.error('Error stopping monitoring:', error);
    res.status(500).json({ error: 'Failed to stop monitoring' });
  }
});

app.post('/api/monitor/speed', (req, res) => {
  try {
    const { mode } = req.body;
    if (!['conservative', 'balanced', 'aggressive', 'ultra'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid mode' });
    }
    
    solanaMonitor.setPollingSpeed(mode);
    res.json({ success: true, message: `Polling speed set to ${mode}` });
  } catch (error) {
    console.error('Error setting polling speed:', error);
    res.status(500).json({ error: 'Failed to set polling speed' });
  }
});

app.post('/api/monitor/token', (req, res) => {
  try {
    const { tokenAddress } = req.body;
    if (!tokenAddress) {
      return res.status(400).json({ error: 'Token address is required' });
    }
    
    solanaMonitor.updateTokenAddress(tokenAddress);
    res.json({ success: true, message: `Token address updated to ${tokenAddress}` });
  } catch (error) {
    console.error('Error updating token address:', error);
    res.status(500).json({ error: 'Failed to update token address' });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  solanaMonitor.stopMonitoring();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  solanaMonitor.stopMonitoring();
  process.exit(0);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Solana Monitor Service running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 Monitor API: http://localhost:${PORT}/api/monitor/stats`);
  
  // Start monitoring automatically
  solanaMonitor.startMonitoring();
});
