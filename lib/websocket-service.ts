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
  private maxReconnectAttempts = 10
  private reconnectDelay = 2000
  private onMessage: ((message: TimerSyncMessage) => void) | null = null
  private clientId: string
  private pollingInterval: NodeJS.Timeout | null = null
  private usePolling = false // Use SSE for real-time updates

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
    try {
      const url = `/api/timer/websocket?clientId=${this.clientId}`
      this.eventSource = new EventSource(url)

      this.eventSource.onopen = () => {
        console.log('Connected to global timer service')
        this.reconnectAttempts = 0
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
        console.error('EventSource error:', error)
        this.handleReconnect()
      }

    } catch (error) {
      console.error('WebSocket connection failed:', error)
      this.handleReconnect()
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      setTimeout(() => {
        console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
        this.connect()
      }, this.reconnectDelay * this.reconnectAttempts)
    } else {
      console.error('Max reconnection attempts reached')
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