import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const webhookData = await request.json()
    
    console.log('🎣 Received Helius webhook:', webhookData)
    
    // Check if this is a transaction involving our token
    if (webhookData.type === 'TRANSFER' || webhookData.type === 'SWAP') {
      console.log('✅ Token transaction detected via webhook')
      
      // Reset the timer via the timer service
      const timerServiceUrl = process.env.TIMER_SERVICE_URL
      if (timerServiceUrl) {
        const response = await fetch(`${timerServiceUrl}/api/timer/reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
        
        if (response.ok) {
          console.log('🔄 Timer reset via webhook notification')
        } else {
          console.error('❌ Failed to reset timer via webhook')
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        message: 'Webhook processed successfully' 
      })
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Webhook received but no action needed' 
    })
    
  } catch (error) {
    console.error('❌ Error processing webhook:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process webhook' },
      { status: 500 }
    )
  }
}
