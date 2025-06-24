'use client'

import { useState, useEffect } from 'react'

interface DevModeSwitcherProps {
  currentView: 'admin' | 'player'
  onViewChange: (view: 'admin' | 'player') => void
}

export default function DevModeSwitcher({ currentView, onViewChange }: DevModeSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)

  const handleViewChange = (view: 'admin' | 'player') => {
    onViewChange(view)
    setIsOpen(false)
    
    // Show notification
    const viewName = view === 'admin' ? 'Admin' : 'Player'
    setNotification(`Switched to ${viewName} view`)
    setTimeout(() => setNotification(null), 2000)
  }

  // Keyboard shortcut: Ctrl+Shift+D to toggle views
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault()
        const newView = currentView === 'admin' ? 'player' : 'admin'
        handleViewChange(newView)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentView])

  // Only show in dev mode
  if (process.env.DEV_MODE !== 'true') {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded-lg shadow-lg transition-colors flex items-center gap-2"
          title="Dev Mode: Switch Views"
        >
          <span className="text-sm font-medium">🔧 DEV</span>
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
              Development Mode
            </div>
            
            <button
              onClick={() => handleViewChange('admin')}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors flex items-center gap-2 ${
                currentView === 'admin' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
              }`}
            >
              <span className="text-lg">👑</span>
              <div>
                <div className="font-medium">Admin View</div>
                <div className="text-xs text-gray-500">Full access & management</div>
              </div>
              {currentView === 'admin' && (
                <span className="ml-auto text-blue-500">✓</span>
              )}
            </button>

            <button
              onClick={() => handleViewChange('player')}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors flex items-center gap-2 ${
                currentView === 'player' ? 'bg-green-50 text-green-700' : 'text-gray-700'
              }`}
            >
              <span className="text-lg">🎮</span>
              <div>
                <div className="font-medium">Player View</div>
                <div className="text-xs text-gray-500">Limited player access</div>
              </div>
              {currentView === 'player' && (
                <span className="ml-auto text-green-500">✓</span>
              )}
            </button>

            <div className="px-3 py-2 text-xs text-gray-500 border-t border-gray-200 mt-1">
              💡 This switcher is only visible in development mode
              <br />
              ⌨️ Shortcut: Ctrl+Shift+D to toggle views
            </div>
          </div>
        )}
      </div>
      
      {/* Overlay to close dropdown when clicking outside */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Notification */}
      {notification && (
        <div className="fixed top-16 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-in slide-in-from-top-2">
          {notification}
        </div>
      )}
    </div>
  )
}
