import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const timerServiceUrl = process.env.TIMER_SERVICE_URL
    if (!timerServiceUrl) {
      throw new Error('TIMER_SERVICE_URL not configured')
    }
    
    const [statsResponse, eventsResponse] = await Promise.all([
      fetch(`${timerServiceUrl}/api/timer/stats`),
      fetch(`${timerServiceUrl}/api/timer/events?limit=100`)
    ])
    
    if (!statsResponse.ok || !eventsResponse.ok) {
      throw new Error('Failed to fetch data from timer service')
    }
    
    const stats = await statsResponse.json()
    const events = await eventsResponse.json()
    
    // Calculate metrics
    const metrics = {
      timestamp: Date.now(),
      instanceId: process.env.INSTANCE_ID || 'unknown',
      
      // Timer metrics
      timer: {
        isActive: stats.data.uptime > 0,
        uptime: stats.data.uptime,
        totalResets: stats.data.totalResets,
        lastReset: stats.data.lastReset,
        connectedClients: stats.data.connectedClients,
        activeInstances: stats.data.instanceId
      },
      
      // System metrics
      system: {
        redisAvailable: stats.data.redisAvailable,
        nodeEnv: process.env.NODE_ENV,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      },
      
      // Event metrics
      events: {
        total: events.data.length,
        resets: events.data.filter((e: any) => e.event === 'reset').length,
        recent: events.data.slice(0, 10).map((e: any) => ({
          event: e.event,
          timestamp: e.timestamp,
          instanceId: e.instanceId
        }))
      },
      
      // Performance metrics
      performance: {
        avgResetInterval: calculateAverageResetInterval(events.data),
        resetFrequency: calculateResetFrequency(events.data),
        systemLoad: process.cpuUsage()
      }
    }
    
    return NextResponse.json(metrics)
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to collect metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    }, { status: 500 })
  }
}

function calculateAverageResetInterval(events: any[]): number {
  const resetEvents = events.filter(e => e.event === 'reset')
  if (resetEvents.length < 2) return 0
  
  const intervals = []
  for (let i = 1; i < resetEvents.length; i++) {
    intervals.push(resetEvents[i].timestamp - resetEvents[i - 1].timestamp)
  }
  
  return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
}

function calculateResetFrequency(events: any[]): number {
  const resetEvents = events.filter(e => e.event === 'reset')
  if (resetEvents.length === 0) return 0
  
  const now = Date.now()
  const oneHourAgo = now - (60 * 60 * 1000)
  const recentResets = resetEvents.filter(e => e.timestamp > oneHourAgo)
  
  return recentResets.length
}