'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { getWebSocketService, TimerSyncMessage } from '@/lib/websocket-service'

// TradeInfo interface (moved from solana-monitor since we no longer import it directly)
export interface TradeInfo {
  type: 'buy' | 'sell'
  amount: number
  dex: string
  signature: string
  timestamp: number
  price?: number
}

// GlobalTimerState interface (moved from global-timer-service-prod)
export interface GlobalTimerState {
  startTime: number
  duration: number
  isActive: boolean
  lastSwapTime: number | null
  serverTime: number
  instanceId: string
}

interface TimerContextType {
  timeLeft: number
  isActive: boolean
  resetTimer: () => void
  lastSwapTime: number | null
  lastTrade: TradeInfo | null
}

const TimerContext = createContext<TimerContextType | undefined>(undefined)

const TIMER_DURATION = 10 * 60 * 1000 // 10 minutes in milliseconds

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION)
  const [isActive, setIsActive] = useState(true)
  const [lastSwapTime, setLastSwapTime] = useState<number | null>(null)
  const [lastTrade, setLastTrade] = useState<TradeInfo | null>(null)
  const [serverTime, setServerTime] = useState<number>(Date.now())
  const wsServiceRef = useRef<ReturnType<typeof getWebSocketService> | null>(null)

  // Function to reset timer
  const resetTimer = useCallback(() => {
    console.log('Timer reset triggered!')
    
    // Send reset to server - this will sync across all users
    const wsService = getWebSocketService()
    wsService.sendTimerReset()
  }, [])

  // Function to update local state from server state
  const updateFromServerState = useCallback((state: GlobalTimerState) => {
    console.log('🔄 Updating from server state:', {
      startTime: state.startTime,
      serverTime: state.serverTime,
      duration: state.duration,
      isActive: state.isActive
    })
    
    setServerTime(state.serverTime)
    setLastSwapTime(state.lastSwapTime)
    setIsActive(state.isActive)
    
    // Calculate time left based on server time
    const elapsed = state.serverTime - state.startTime
    const remaining = Math.max(0, state.duration - elapsed)
    console.log('⏰ Calculated time left:', remaining, 'ms (', Math.floor(remaining / 60000), 'min', Math.floor((remaining % 60000) / 1000), 'sec)')
    setTimeLeft(remaining)
  }, [])

  // Initialize global timer synchronization
  useEffect(() => {
    // Initialize WebSocket service for global sync
    const wsService = getWebSocketService()
    wsServiceRef.current = wsService
    
    wsService.setMessageHandler((message: TimerSyncMessage) => {
      if (message.type === 'initial' && message.data) {
        console.log('Received initial timer state from server')
        updateFromServerState(message.data)
      } else if (message.type === 'update' && message.data) {
        console.log('Received timer update from server')
        updateFromServerState(message.data)
      } else if (message.type === 'timer_reset' && message.data) {
        console.log('Received timer reset from server')
        updateFromServerState(message.data)
        // Update last trade info if available
        if (message.data.lastSwapTime) {
          setLastSwapTime(message.data.lastSwapTime)
        }
      } else if (message.type === 'ping') {
        // Keep connection alive
        console.log('Received ping from server')
      }
    })

    // Note: Solana monitoring is now handled by the dedicated service
    // The timer service will automatically reset when trades are detected

    return () => {
      wsService.disconnect()
    }
  }, [resetTimer, updateFromServerState])

  // Local countdown effect (for smooth UI updates)
  useEffect(() => {
    if (!isActive || timeLeft <= 0) return

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1000) {
          setIsActive(false)
          return 0
        }
        return prev - 1000
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isActive, timeLeft])

  const value: TimerContextType = {
    timeLeft,
    isActive,
    resetTimer,
    lastSwapTime,
    lastTrade
  }

  return (
    <TimerContext.Provider value={value}>
      {children}
    </TimerContext.Provider>
  )
}

export function useTimer() {
  const context = useContext(TimerContext)
  if (context === undefined) {
    throw new Error('useTimer must be used within a TimerProvider')
  }
  return context
}