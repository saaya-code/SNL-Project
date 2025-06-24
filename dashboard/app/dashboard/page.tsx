'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Game, Team, Application } from '@/types/index'
import { gamesApi, teamsApi, applicationsApi } from '@/lib/api'
import AdminDashboard from '@/components/dashboard/admin-dashboard'
import PlayerDashboard from '@/components/dashboard/player-dashboard'
import LoadingSpinner from '@/components/ui/loading-spinner'
import DevModeSwitcher from '@/components/ui/dev-mode-switcher'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [games, setGames] = useState<Game[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [error, setError] = useState<string | null>(null)
  const [devModeView, setDevModeView] = useState<'admin' | 'player' | null>(null)

  // Load dev mode view preference from localStorage
  useEffect(() => {
    if (process.env.DEV_MODE === 'true') {
      const savedView = localStorage.getItem('devModeView') as 'admin' | 'player' | null
      if (savedView) {
        setDevModeView(savedView)
      }
    }
  }, [])

  // Save dev mode view preference to localStorage
  const handleDevModeViewChange = (view: 'admin' | 'player') => {
    setDevModeView(view)
    localStorage.setItem('devModeView', view)
  }

  useEffect(() => {
    if (status === 'loading') return
    
    if (status === 'unauthenticated') {
      router.push('/')
      return
    }

    loadDashboardData()
  }, [status, router])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [gamesData, teamsData, applicationsData] = await Promise.all([
        gamesApi.getAll(),
        teamsApi.getAll(),
        applicationsApi.getAll()
      ])

      setGames(gamesData)
      setTeams(teamsData)
      setApplications(applicationsData)
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
      setError('Failed to load dashboard data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const refreshData = () => {
    loadDashboardData()
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-200 mb-2">Error</h2>
          <p className="text-red-300 mb-4">{error}</p>
          <button
            onClick={refreshData}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  const isAdmin = (session?.user as any)?.isAdmin || (session?.user as any)?.isModerator
  const isDev = process.env.DEV_MODE === 'true'
  
  // In dev mode, use the switcher's preference, otherwise use actual admin status
  const showAdminView = isDev && devModeView !== null ? devModeView === 'admin' : isAdmin

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-blue-900 to-purple-900">
      {/* Dev Mode Switcher */}
      {isDev && (
        <DevModeSwitcher
          currentView={devModeView !== null ? devModeView : (isAdmin ? 'admin' : 'player')}
          onViewChange={handleDevModeViewChange}
        />
      )}
      
      {showAdminView ? (
        <AdminDashboard
          games={games}
          teams={teams}
          applications={applications}
          user={session?.user as any}
          onRefresh={refreshData}
        />
      ) : (
        <PlayerDashboard
          games={games}
          teams={teams}
          applications={applications}
          user={session?.user as any}
          onRefresh={refreshData}
        />
      )}
    </div>
  )
}
