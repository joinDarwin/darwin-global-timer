const express = require('express');
const Redis = require('ioredis');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Redis connection
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Timer Service Class - handles all timer logic
class TimerService {
  constructor() {
    this.updateInterval = null;
    this.subscribers = new Set();
    this.isRedisAvailable = false;
    this.memoryState = null; // In-memory fallback
    this.initializeRedis();
  }

  async initializeRedis() {
    try {
      await redis.ping();
      this.isRedisAvailable = true;
      console.log('✅ Redis connected for timer service');
      this.startTimer();
    } catch (error) {
      console.error('❌ Redis connection failed:', error);
      console.log('🔄 Using in-memory storage as fallback');
      this.isRedisAvailable = false;
      this.startTimer(); // Start timer even without Redis
    }
  }

  startTimer() {
    const updateInterval = parseInt(process.env.TIMER_UPDATE_INTERVAL || '1000');
    
    this.updateInterval = setInterval(async () => {
      try {
        await this.updateTimerState();
      } catch (error) {
        console.error('Error updating timer state:', error);
      }
    }, updateInterval);

    console.log(`🕐 Timer service started with ${updateInterval}ms update interval`);
  }

  async updateTimerState() {
    try {
      const currentState = await this.getCurrentState();
      const updatedState = {
        ...currentState,
        serverTime: Date.now(),
        instanceId: this.getInstanceId()
      };

      if (this.isRedisAvailable) {
        // Store updated state in Redis
        await redis.setex(
          `${this.getKeyPrefix()}:timer:state`,
          3600, // 1 hour TTL
          JSON.stringify(updatedState)
        );

        // Publish to Redis for other instances
        await redis.publish(
          `${this.getKeyPrefix()}:timer:updates`,
          JSON.stringify(updatedState)
        );
      } else {
        // Store in memory as fallback
        this.memoryState = updatedState;
      }

      // Notify local subscribers
      this.notifySubscribers(updatedState);

    } catch (error) {
      console.error('Error updating timer state:', error);
    }
  }

  async getCurrentState() {
    try {
      let stateJson = null;
      
      if (this.isRedisAvailable) {
        stateJson = await redis.get(`${this.getKeyPrefix()}:timer:state`);
      } else if (this.memoryState) {
        stateJson = JSON.stringify(this.memoryState);
      }
      
      if (!stateJson) {
        // Initialize new timer state
        const initialState = this.getDefaultState();
        await this.storeTimerState(initialState);
        console.log(`[${this.getInstanceId()}] Initialized new timer state`);
        return initialState;
      }

      const state = JSON.parse(stateJson);
      const now = Date.now();
      const elapsed = now - state.startTime;
      const remaining = Math.max(0, state.duration - elapsed);

      return {
        ...state,
        serverTime: now,
        isActive: remaining > 0
      };
    } catch (error) {
      console.error('Error getting current state:', error);
      return this.getDefaultState();
    }
  }

  async resetTimer(tradeInfo = null) {
    console.log(`[${this.getInstanceId()}] Resetting global timer`);
    
    const resetState = {
      startTime: Date.now(),
      duration: parseInt(process.env.TIMER_DEFAULT_DURATION || '600000'),
      isActive: true,
      lastSwapTime: Date.now(),
      serverTime: Date.now(),
      instanceId: this.getInstanceId(),
      lastTrade: tradeInfo || null
    };

    // Store reset state in Redis
    await this.storeTimerState(resetState);
    console.log(`[${this.getInstanceId()}] Timer state stored in Redis`);

    // Notify local subscribers
    this.notifySubscribers(resetState);

    // Publish reset event
    if (this.isRedisAvailable) {
      try {
        await redis.publish(
          `${this.getKeyPrefix()}:timer:reset`,
          JSON.stringify(resetState)
        );
        console.log(`[${this.getInstanceId()}] Reset event published to Redis`);
      } catch (error) {
        console.error('Error publishing reset to Redis:', error);
      }
    }

    // Log event
    await this.logTimerEvent('reset', resetState);
    console.log(`[${this.getInstanceId()}] Reset event logged`);

    return resetState;
  }

  async storeTimerState(state) {
    try {
      if (this.isRedisAvailable) {
        await redis.setex(
          `${this.getKeyPrefix()}:timer:state`,
          3600, // 1 hour TTL
          JSON.stringify(state)
        );
      } else {
        // Store in memory as fallback
        this.memoryState = state;
        console.log('Timer state stored in memory (Redis unavailable)');
      }
    } catch (error) {
      console.error('Error storing timer state:', error);
      throw error;
    }
  }

  async logTimerEvent(event, state) {
    const eventData = {
      event,
      timestamp: Date.now(),
      instanceId: this.getInstanceId(),
      state
    };

    if (this.isRedisAvailable) {
      try {
        // Store in Redis with TTL
        await redis.lpush(
          `${this.getKeyPrefix()}:events`,
          JSON.stringify(eventData)
        );
        
        // Keep only last 1000 events
        await redis.ltrim(`${this.getKeyPrefix()}:events`, 0, 999);
      } catch (error) {
        console.error('Error logging event to Redis:', error);
      }
    } else {
      // Fallback to console logging
      console.log('Timer Event:', eventData);
    }
  }

  async getRecentEvents(limit = 100) {
    if (!this.isRedisAvailable) return [];

    try {
      const events = await redis.lrange(
        `${this.getKeyPrefix()}:events`,
        0,
        limit - 1
      );
      
      return events.map(event => JSON.parse(event));
    } catch (error) {
      console.error('Error getting events from Redis:', error);
      return [];
    }
  }

  async getStats() {
    const state = await this.getCurrentState();
    const events = await this.getRecentEvents(1000);
    
    const resets = events.filter(e => e.event === 'reset').length;
    const uptime = Date.now() - state.startTime;
    
    return {
      connectedClients: this.subscribers.size,
      totalResets: resets,
      uptime,
      lastReset: state.lastSwapTime,
      instanceId: this.getInstanceId(),
      redisAvailable: this.isRedisAvailable
    };
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    
    // Immediately send current state
    this.getCurrentState().then(callback).catch(console.error);
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  notifySubscribers(state) {
    this.subscribers.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        console.error('Error notifying subscriber:', error);
      }
    });
  }

  getDefaultState() {
    return {
      startTime: Date.now(),
      duration: parseInt(process.env.TIMER_DEFAULT_DURATION || '600000'),
      isActive: true,
      lastSwapTime: null,
      serverTime: Date.now(),
      instanceId: this.getInstanceId()
    };
  }

  getKeyPrefix() {
    return process.env.REDIS_KEY_PREFIX || 'darwin-timer';
  }

  getInstanceId() {
    return process.env.INSTANCE_ID || `timer-service-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.subscribers.clear();
    redis.disconnect();
  }
}

// Initialize timer service
const timerService = new TimerService();

// API Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'timer-service',
    instanceId: timerService.getInstanceId(),
    redisAvailable: timerService.isRedisAvailable
  });
});

app.get('/api/timer/state', async (req, res) => {
  try {
    const state = await timerService.getCurrentState();
    res.json({ success: true, data: state });
  } catch (error) {
    console.error('Error getting timer state:', error);
    res.status(500).json({ error: 'Failed to get timer state' });
  }
});

app.post('/api/timer/reset', async (req, res) => {
  try {
    const newState = await timerService.resetTimer();
    res.json({ 
      success: true, 
      message: 'Timer reset successfully',
      data: newState 
    });
  } catch (error) {
    console.error('Error resetting timer:', error);
    res.status(500).json({ error: 'Failed to reset timer' });
  }
});

// Webhook endpoint for Solana monitor service
app.post('/api/trade-detected', async (req, res) => {
  try {
    const { tradeInfo } = req.body;
    console.log('🎣 Trade detected, resetting timer:', tradeInfo);
    
    const newState = await timerService.resetTimer(tradeInfo);
    res.json({ 
      success: true, 
      message: 'Timer reset due to trade detection',
      data: newState 
    });
  } catch (error) {
    console.error('Error processing trade detection:', error);
    res.status(500).json({ error: 'Failed to process trade detection' });
  }
});

app.get('/api/timer/stats', async (req, res) => {
  try {
    const stats = await timerService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error getting timer stats:', error);
    res.status(500).json({ error: 'Failed to get timer stats' });
  }
});

app.get('/api/timer/events', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const events = await timerService.getRecentEvents(limit);
    res.json({ success: true, data: events });
  } catch (error) {
    console.error('Error getting timer events:', error);
    res.status(500).json({ error: 'Failed to get timer events' });
  }
});

// Server-Sent Events endpoint for real-time updates
app.get('/api/timer/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  const unsubscribe = timerService.subscribe((state) => {
    const data = `data: ${JSON.stringify({
      type: 'update',
      data: state,
      timestamp: Date.now()
    })}\n\n`;
    res.write(data);
  });

  // Keep connection alive with periodic pings
  const pingInterval = setInterval(() => {
    const ping = `data: ${JSON.stringify({
      type: 'ping',
      timestamp: Date.now()
    })}\n\n`;
    res.write(ping);
  }, 30000);

  // Handle client disconnect
  req.on('close', () => {
    unsubscribe();
    clearInterval(pingInterval);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  timerService.destroy();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  timerService.destroy();
  process.exit(0);
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`🚀 Timer Service running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`⏰ Timer API: http://localhost:${PORT}/api/timer/state`);
});
