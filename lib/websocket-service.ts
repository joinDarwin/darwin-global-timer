export interface TimerSyncMessage {
  type: 'initial' | 'update' | 'timer_reset' | 'ping' | 'error'
  timestamp: number
  data?: any
  clientId?: string
  timeLeft?: number
  lastSwapTime?: number
  message?: string
}

export class WebSocketService {
  private eventSource: EventSource | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5 // Reduce max attempts to prevent resource exhaustion
  private reconnectDelay = 3000 // Increase delay between attempts
  private onMessage: ((message: TimerSyncMessage) => void) | null = null
  private clientId: string
  private pollingInterval: NodeJS.Timeout | null = null
  private usePolling = false // Use SSE for real-time updates
  private isConnecting = false
  private connectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected'

  constructor() {
    this.clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    if (this.usePolling) {
      this.startPolling()
    } else {
      this.connect()
    }
  }

  setMessageHandler(handler: (message: TimerSyncMessage) => void) {
    this.onMessage = handler
  }

  private startPolling() {
    console.log('Starting timer polling...')
    this.pollingInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/timer')
        if (response.ok) {
          const data = await response.json()
          if (data.success && this.onMessage) {
            this.onMessage({
              type: 'update',
              timestamp: Date.now(),
              data: data.data,
              clientId: this.clientId
            })
          }
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, 2000) // Poll every 2 seconds
  }

  private connect() {
    // Prevent multiple simultaneous connection attempts
    if (this.isConnecting || this.connectionState === 'connected') {
      console.log('Connection already in progress or established')
      return
    }

    this.isConnecting = true
    this.connectionState = 'connecting'
    
    // Clean up any existing connection first
    this.disconnect()
    
    try {
      const url = `/api/timer/websocket?clientId=${this.clientId}`
      console.log('Attempting to connect to:', url)
      this.eventSource = new EventSource(url)

      this.eventSource.onopen = () => {
        console.log('✅ Connected to global timer service')
        this.reconnectAttempts = 0
        this.isConnecting = false
        this.connectionState = 'connected'
        // Send initial message to confirm connection
        if (this.onMessage) {
          this.onMessage({
            type: 'initial',
            timestamp: Date.now(),
            clientId: this.clientId,
            message: 'Connected to timer service'
          })
        }
      }

      this.eventSource.onmessage = (event) => {
        try {
          const message: TimerSyncMessage = JSON.parse(event.data)
          this.onMessage?.(message)
        } catch (error) {
          console.error('Error parsing message:', error)
        }
      }

      this.eventSource.onerror = (error) => {
        console.error('❌ EventSource error:', error)
        this.isConnecting = false
        this.connectionState = 'disconnected'
        this.handleReconnect()
      }

    } catch (error) {
      console.error('❌ WebSocket connection failed:', error)
      this.isConnecting = false
      this.connectionState = 'disconnected'
      this.handleReconnect()
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1) // Exponential backoff
      console.log(`🔄 Attempting to reconnect in ${delay}ms... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
      setTimeout(() => {
        this.connect()
      }, delay)
    } else {
      console.error('❌ Max reconnection attempts reached. Switching to fallback mode.')
      this.connectionState = 'disconnected'
      // Could implement fallback to polling here if needed
    }
  }

  async sendTimerReset() {
    try {
      const response = await fetch('/api/timer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'reset' })
      })
      
      if (!response.ok) {
        throw new Error('Failed to reset timer')
      }
      
      console.log('Timer reset sent to server')
    } catch (error) {
      console.error('Error sending timer reset:', error)
    }
  }

  disconnect() {
    console.log('🔌 Disconnecting WebSocket service')
    this.isConnecting = false
    this.connectionState = 'disconnected'
    
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
  }
}

// Singleton instance
let wsServiceInstance: WebSocketService | null = null

export function getWebSocketService(): WebSocketService {
  if (!wsServiceInstance) {
    wsServiceInstance = new WebSocketService()
  }
  return wsServiceInstance
}