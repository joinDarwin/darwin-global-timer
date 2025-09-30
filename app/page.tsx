import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Bitcoin, Clock, Trophy, User, X, Send, Target, Wheat } from "lucide-react"
import { TimerProvider, useTimer } from "@/contexts/TimerContext"
import { VaultTimer } from "@/components/VaultTimer"

function LastBidderDisplay() {
  const { lastBuyer } = useTimer()
  
  const formatAddress = (address: string | null) => {
    if (!address) return "No trades yet"
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }
  
  return (
    <div className="text-white font-bold text-base">
      {formatAddress(lastBuyer)}
    </div>
  )
}

export default function MicroScratchetyPage() {
  return (
    <TimerProvider>
      <div
        className="min-h-screen relative"
        style={{
          backgroundColor: '#1f1f22',
        }}
      >
      {/* Header */}
      <header className="flex justify-between items-center p-6">
        <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center shadow-lg">
          <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
          </svg>
        </div>
        <Button
          className="border-white/20 text-white hover:bg-gradient-to-br hover:from-white/15 hover:to-black/30 px-12 py-6 shadow-lg backdrop-blur-md font-medium transition-all duration-200 ring-1 ring-white/10"
          style={{ 
            borderRadius: '8px',
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(0, 0, 0, 0.08) 100%)'
          }}
        >
          Connect Wallet
        </Button>
      </header>

      {/* Main Content */}
      <div className="flex justify-center items-center min-h-[calc(100vh-120px)]">
        <Card 
          className="w-full max-w-md border-white/20 p-4 space-y-1 backdrop-blur-lg shadow-2xl shadow-black/20 ring-1 ring-white/10"
          style={{ 
            borderRadius: '8px',
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(0, 0, 0, 0.15) 100%)'
          }}
        >
          {/* Header with Logo and Title */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Bitcoin className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-white font-bold text-xl">MicroScratchety</h1>
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
                    <svg viewBox="0 0 24 24" className="w-3 h-3 text-white" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  </div>
                </div>
                <p className="text-gray-400 text-sm font-medium">$BITCH...</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="text-gray-400 hover:text-white hover:bg-gray-700/50 p-2 h-8 w-8 rounded-lg"
              >
                <X className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-gray-400 hover:text-white hover:bg-gray-700/50 p-2 h-8 w-8 rounded-lg"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Vault Timer */}
          <VaultTimer />

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-white/20 p-4 shadow-md ring-1 ring-white/10 backdrop-blur-md" style={{ background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.07) 0%, rgba(0, 0, 0, 0.1) 100%)', borderRadius: '8px' }}>
              <div className="flex items-center gap-2 mb-0">
                <Bitcoin className="w-3 h-3 text-gray-500" />
                <span className="text-gray-400 text-xs font-medium">Treasury Vault</span>
              </div>
              <div className="flex items-center gap-1">
                <Bitcoin className="w-4 h-4 text-orange-500" />
                <span className="text-white font-bold text-base">5.293 Bitcoin</span>
              </div>
            </Card>

            <Card className="border-white/20 p-4 shadow-md ring-1 ring-white/10 backdrop-blur-md" style={{ background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.07) 0%, rgba(0, 0, 0, 0.1) 100%)', borderRadius: '8px' }}>
              <div className="flex items-center gap-2 mb-0">
                <Trophy className="w-3 h-3 text-gray-500" />
                <span className="text-gray-400 text-xs font-medium">Scratcher Potential</span>
              </div>
              <div className="text-white font-bold text-base leading-tight">$48,384,283,234</div>
            </Card>

            <Card className="border-white/20 p-4 shadow-md ring-1 ring-white/10 backdrop-blur-md" style={{ background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.07) 0%, rgba(0, 0, 0, 0.1) 100%)', borderRadius: '8px' }}>
              <div className="flex items-center gap-2 mb-0">
                <Clock className="w-3 h-3 text-gray-500" />
                <span className="text-gray-400 text-xs font-medium">End Game</span>
              </div>
              <div className="text-white font-bold text-base">467 Days</div>
            </Card>

            <Card className="border-white/20 p-4 shadow-md ring-1 ring-white/10 backdrop-blur-md" style={{ background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.07) 0%, rgba(0, 0, 0, 0.1) 100%)', borderRadius: '8px' }}>
              <div className="flex items-center gap-2 mb-0">
                <User className="w-3 h-3 text-gray-500" />
                <span className="text-gray-400 text-xs font-medium">Last Bidder</span>
              </div>
              <LastBidderDisplay />
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <Button 
              className="w-full h-14 text-gray-900 font-bold text-base shadow-lg transition-all duration-200 hover:shadow-xl border border-gray-400/50"
              style={{ 
                borderRadius: '8px',
                background: 'linear-gradient(to right, #f3f4f6, #e5e7eb, #f3f4f6)'
              }}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2" fill="currentColor">
                <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10Z" />
              </svg>
              Buy 1 to Hunt 48,948x
            </Button>
            <Button 
              className="w-full h-14 text-white font-bold text-base shadow-lg transition-all duration-200 hover:shadow-xl border border-orange-400/50"
              style={{ 
                borderRadius: '8px',
                background: 'linear-gradient(to right, #ca5208, #9f450a, #ca5208)'
              }}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2" fill="currentColor">
                <path d="M12,1A9,9 0 0,1 21,10C21,12.5 19.8,14.7 18,16.2L12,13L6,16.2C4.2,14.7 3,12.5 3,10A9,9 0 0,1 12,1M12,3A7,7 0 0,0 5,10C5,11.5 5.5,12.9 6.4,14L12,11.5L17.6,14C18.5,12.9 19,11.5 19,10A7,7 0 0,0 12,3M9,14L12,16L15,14M10,16L12,17.5L14,16M12,19L11,20H13L12,19M11,20V22H13V20Z" />
              </svg>
              Buy 100 to Farm 83% APY
            </Button>
          </div>
        </Card>
      </div>
      </div>
    </TimerProvider>
  )
}
