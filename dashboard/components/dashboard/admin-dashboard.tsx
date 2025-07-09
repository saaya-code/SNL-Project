'use client'

import { useState, useEffect } from 'react'
import { Game, Team, Application, User } from '@/types/index'
import { 
  Users, 
  Gamepad2, 
  Settings, 
  Plus,
  Play,
  Pause,
  RotateCcw,
  UserCheck,
  UserX,
  Trash2,
  Eye,
  MapPin,
  TrendingUp,
  Award,
  Clock,
  Crown,
  Target,
  Trophy,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  Shield,
  Send,
  Calendar,
  Dice6
} from 'lucide-react'
import { gamesApi, teamsApi, applicationsApi } from '@/lib/api'
import { toast } from 'react-hot-toast'
import TeamDistributionEditor from '@/components/ui/team-distribution-editor'
import TileEditor from '@/components/ui/tile-editor'

interface AdminDashboardProps {
  games: Game[]
  teams: Team[]
  applications: Application[]
  user: User
  onRefresh: () => void
}

export default function AdminDashboard({ 
  games, 
  teams, 
  applications, 
  user, 
  onRefresh 
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'games' | 'teams' | 'applications' | 'board' | 'editor'>('games')
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [gameTeams, setGameTeams] = useState<Team[]>([])
  const [gameApplications, setGameApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(false)
  const [boardImageKey, setBoardImageKey] = useState<number>(Date.now())
  const [boardLoading, setBoardLoading] = useState(false)
  const [teamManagementMode, setTeamManagementMode] = useState(false)
  const [selectedMember, setSelectedMember] = useState<any>(null)
  const [draggedMember, setDraggedMember] = useState<any>(null)
  const [announcementChannelId, setAnnouncementChannelId] = useState('')
  const [announcementWebhookUrl, setAnnouncementWebhookUrl] = useState('')
  const [applicationFilter, setApplicationFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all')
  const [teamDistributionDialog, setTeamDistributionDialog] = useState<{
    isOpen: boolean
    distributedTeams: Team[]
    gameData: any
  }>({
    isOpen: false,
    distributedTeams: [],
    gameData: null
  })
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    action: () => void
    type: 'danger' | 'warning' | 'info'
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: () => {},
    type: 'info'
  })
  const [tileEditorDialog, setTileEditorDialog] = useState<{
    isOpen: boolean
    tileNumber: number | null
    tileData: any
  }>({
    isOpen: false,
    tileNumber: null,
    tileData: null
  })

  // Debug: Log user object on mount
  useEffect(() => {
    console.log('Admin Dashboard - User object:', user)
    console.log('User ID:', user?.id)
    console.log('User keys:', Object.keys(user || {}))
  }, [user])

  // Load data for selected game
  useEffect(() => {
    if (selectedGame) {
      loadGameData(selectedGame.gameId)
      // Update announcement channel input when game is selected
      setAnnouncementChannelId(selectedGame.announcementChannelId || '')
      setAnnouncementWebhookUrl(selectedGame.announcementWebhookUrl || '')
    }
  }, [selectedGame])

  // Auto-refresh board image and game data when viewing the board tab
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    if (activeTab === 'board' && selectedGame) {
      // Refresh immediately
      refreshBoardData()
      
      // Set up polling every 10 seconds
      interval = setInterval(() => {
        refreshBoardData()
      }, 10000)
    }
    
    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [activeTab, selectedGame])

  const loadGameData = async (gameId: string) => {
    try {
      setLoading(true)
      const [teamsData, applicationsData] = await Promise.all([
        teamsApi.getByGame(gameId),
        applicationsApi.getByGame(gameId)
      ])
      setGameTeams(teamsData)
      setGameApplications(applicationsData)
    } catch (error) {
      console.error('Error loading game data:', error)
      toast.error('Failed to load game data')
    } finally {
      setLoading(false)
    }
  }

  const refreshBoardData = async () => {
    if (!selectedGame) return
    
    try {
      setBoardLoading(true)
      // Refresh teams data to get latest positions
      const teamsData = await teamsApi.getByGame(selectedGame.gameId)
      setGameTeams(teamsData)
      
      // Force board image refresh by updating the cache-busting key
      setBoardImageKey(Date.now())
    } catch (error) {
      console.error('Error refreshing board data:', error)
    } finally {
      setBoardLoading(false)
    }
  }

  const forceBoardRefresh = () => {
    setBoardImageKey(Date.now())
    if (selectedGame) {
      loadGameData(selectedGame.gameId)
    }
  }

  const showConfirmDialog = (title: string, message: string, action: () => void, type: 'danger' | 'warning' | 'info' = 'info') => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      action,
      type
    })
  }

  const handleGameAction = async (gameId: string, action: string) => {
    const game = games.find(g => g.gameId === gameId)
    if (!game) return

    const actions = {
      'start-registration': () => {
        showConfirmDialog(
          'Start Registration',
          `Are you sure you want to start registration for "${game.name}"? This will allow players to apply to join teams.`,
          async () => {
            try {
              setLoading(true)
              await gamesApi.startRegistration(gameId, game.maxTeamSize)
              toast.success('Registration started!')
              onRefresh()
            } catch (error) {
              console.error('Start registration failed:', error)
              toast.error('Failed to start registration')
            } finally {
              setLoading(false)
            }
          },
          'info'
        )
      },
      'start-game': () => {
        // First, get accepted applications count
        const getAcceptedCount = async () => {
          try {
            const applications = await applicationsApi.getByGame(gameId)
            return applications.filter(app => app.status === 'accepted').length
          } catch (error) {
            console.error('Error getting applications:', error)
            return 0
          }
        }

        const showTeamDistributionDialog = async () => {
          const acceptedCount = await getAcceptedCount()
          const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true' || localStorage.getItem('devMode') === 'true'
          
          if (!isDevMode && acceptedCount < 2) {
            showConfirmDialog(
              'Cannot Start Game',
              `Only ${acceptedCount} accepted participant(s) found. At least 2 participants are required to start the game in normal mode.`,
              () => {}, // No action
              'danger'
            )
            return
          }
          
          if (acceptedCount === 0) {
            showConfirmDialog(
              'Cannot Start Game',
              'No accepted applications found for this game. Please accept some applications first.',
              () => {}, // No action
              'danger'
            )
            return
          }

          // Distribute teams and show dialog
          try {
            setLoading(true)
            const result = await gamesApi.distributeTeams(gameId)
            
            setTeamDistributionDialog({
              isOpen: true,
              distributedTeams: result.teams,
              gameData: { gameId, acceptedApplications: result.acceptedApplications, devMode: result.devMode }
            })
          } catch (error: any) {
            console.error('Team distribution failed:', error)
            const errorMessage = error.response?.data?.error || 'Failed to distribute teams'
            toast.error(errorMessage)
          } finally {
            setLoading(false)
          }
        }

        showTeamDistributionDialog()
      },
      'reset': () => {
        showConfirmDialog(
          'Reset Game',
          `Are you sure you want to reset "${game.name}"? This will reset all team positions to the starting position but keep teams intact.`,
          async () => {
            try {
              setLoading(true)
              await gamesApi.resetGame(gameId, 'active')
              toast.success('Game reset!')
              onRefresh()
            } catch (error) {
              console.error('Reset game failed:', error)
              toast.error('Failed to reset game')
            } finally {
              setLoading(false)
            }
          },
          'warning'
        )
      },
      'delete': () => {
        showConfirmDialog(
          'Delete Game',
          `Are you sure you want to permanently delete "${game.name}"? This action cannot be undone and will remove all associated teams and applications.`,
          async () => {
            try {
              setLoading(true)
              await gamesApi.delete(gameId)
              toast.success('Game deleted!')
              if (selectedGame?.gameId === gameId) {
                setSelectedGame(null)
              }
              onRefresh()
            } catch (error) {
              console.error('Delete game failed:', error)
              toast.error('Failed to delete game')
            } finally {
              setLoading(false)
            }
          },
          'danger'
        )
      }
    }

    if (actions[action as keyof typeof actions]) {
      actions[action as keyof typeof actions]()
    }
  }

  const handleTeamVerification = async (teamId: string, canRoll: boolean) => {
    // Look for team in both gameTeams and global teams
    const team = gameTeams.find(t => t.teamId === teamId) || 
                 teams.find(t => t.teamId === teamId)
    if (!team) {
      toast.error('Team not found')
      return
    }

    const action = canRoll ? 'verify' : 'unverify'
    const message = canRoll 
      ? `Allow team "${team.teamName}" to roll dice?`
      : `Prevent team "${team.teamName}" from rolling dice?`

    showConfirmDialog(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Team`,
      message,
      async () => {
        try {
          setLoading(true)
          await teamsApi.setVerification(teamId, canRoll)
          toast.success(`Team ${action}ed!`)
          if (selectedGame) {
            loadGameData(selectedGame.gameId)
          }
          // Force board refresh if we're viewing the board
          if (activeTab === 'board') {
            forceBoardRefresh()
          }
          onRefresh()
        } catch (error) {
          console.error('Team verification failed:', error)
          toast.error('Failed to update team verification')
        } finally {
          setLoading(false)
        }
      },
      canRoll ? 'info' : 'warning'
    )
  }

  const handleApplicationAction = async (applicationId: string, action: 'accept' | 'reject', notes?: string, newStatus?: 'pending' | 'accepted' | 'rejected') => {
    // Look for application in both arrays - prioritize the full list
    const application = applications.find(a => a.applicationId === applicationId) ||
                       gameApplications.find(a => a.applicationId === applicationId)
    
    console.log('Looking for application:', applicationId)
    console.log('all applications:', applications.map(a => ({ id: a.applicationId, name: a.displayName, gameId: a.gameId })))
    console.log('gameApplications:', gameApplications.map(a => ({ id: a.applicationId, name: a.displayName, gameId: a.gameId })))
    console.log('Found application:', application ? { id: application.applicationId, name: application.displayName, gameId: application.gameId } : null)
    
    if (!application) {
      toast.error('Application not found')
      return
    }

    // Debug: Check if user.id exists - try multiple possible ID fields
    const userId = user?.id || (user as any)?.sub || (user as any)?.userId
    if (!userId) {
      console.error('User ID is missing. User object:', user)
      toast.error('User authentication issue. Please refresh the page.')
      return
    }

    // If newStatus is provided, we're changing status directly
    if (newStatus) {
      try {
        setLoading(true)
        console.log(`Changing application status to:`, newStatus, 'for application:', applicationId)
        
        if (newStatus === 'accepted') {
          await applicationsApi.accept(applicationId, userId, notes)
        } else if (newStatus === 'rejected') {
          await applicationsApi.reject(applicationId, userId, notes)
        } else {
          // For pending status, we need to call the updateStatus API
          await applicationsApi.updateStatus(applicationId, 'pending')
        }
        
        toast.success(`Application status changed to ${newStatus}!`)
        
        // Refresh both game-specific and global data
        if (selectedGame) {
          await loadGameData(selectedGame.gameId)
        }
        onRefresh()
      } catch (error: any) {
        console.error(`Status change failed:`, error)
        if (error.response) {
          console.error('Error response:', error.response.data)
          console.error('Error status:', error.response.status)
          toast.error(`Failed to change status: ${error.response.data?.error || error.message}`)
        } else {
          toast.error(`Failed to change status: ${error.message}`)
        }
      } finally {
        setLoading(false)
      }
      return
    }

    showConfirmDialog(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Application`,
      `Are you sure you want to ${action} ${application.displayName}'s application for "${games.find(g => g.gameId === application.gameId)?.name || 'Unknown Game'}"?`,
      async () => {
        try {
          setLoading(true)
          console.log(`Attempting to ${action} application:`, applicationId, 'by user:', userId)
          
          if (action === 'accept') {
            await applicationsApi.accept(applicationId, userId, notes)
          } else {
            await applicationsApi.reject(applicationId, userId, notes)
          }
          
          toast.success(`Application ${action}ed!`)
          
          // Refresh both game-specific and global data
          if (selectedGame) {
            await loadGameData(selectedGame.gameId)
          }
          onRefresh() // This should refresh the global applications list
        } catch (error: any) {
          console.error(`Application ${action} failed:`, error)
          
          // More detailed error logging
          if (error.response) {
            console.error('Error response:', error.response.data)
            console.error('Error status:', error.response.status)
            toast.error(`Failed to ${action} application: ${error.response.data?.error || error.message}`)
          } else {
            toast.error(`Failed to ${action} application: ${error.message}`)
          }
        } finally {
          setLoading(false)
        }
      },
      action === 'reject' ? 'warning' : 'info'
    )
  }

  const handleApplicationStatusChange = (applicationId: string, newStatus: 'pending' | 'accepted' | 'rejected') => {
    const application = applications.find(a => a.applicationId === applicationId) ||
                       gameApplications.find(a => a.applicationId === applicationId)
    
    if (!application) {
      toast.error('Application not found')
      return
    }

    showConfirmDialog(
      'Change Application Status',
      `Are you sure you want to change ${application.displayName}'s application status to "${newStatus}"?`,
      () => handleApplicationAction(applicationId, 'accept', undefined, newStatus),
      'info'
    )
  }

  const getGameStats = () => {
    return {
      totalGames: games.length,
      activeGames: games.filter(g => g.status === 'active').length,
      registrationGames: games.filter(g => g.status === 'registration').length,
      totalTeams: teams.length,
      pendingApplications: applications.filter(a => a.status === 'pending').length
    }
  }

  const stats = getGameStats()

  const handleTeamMemberExchange = async (sourceTeamId: string, targetTeamId: string, memberToMove: any) => {
    if (!selectedGame || selectedGame.status === 'active') {
      toast.error('Cannot modify teams after game has started')
      return
    }

    const sourceTeam = gameTeams.find(t => t.teamId === sourceTeamId)
    const targetTeam = gameTeams.find(t => t.teamId === targetTeamId)
    
    if (!sourceTeam || !targetTeam) {
      toast.error('Teams not found')
      return
    }

    showConfirmDialog(
      'Exchange Team Member',
      `Move ${memberToMove.displayName} from ${sourceTeam.teamName} to ${targetTeam.teamName}?`,
      async () => {
        try {
          setLoading(true)
          await teamsApi.exchangeMembers(sourceTeamId, targetTeamId, memberToMove)
          toast.success('Team member exchanged successfully!')
          loadGameData(selectedGame.gameId)
        } catch (error) {
          console.error('Team member exchange failed:', error)
          toast.error('Failed to exchange team member')
        } finally {
          setLoading(false)
        }
      },
      'info'
    )
  }

  const handleAnnouncementChannelUpdate = async () => {
    if (!selectedGame) {
      toast.error('Please select a game first')
      return
    }

    try {
      setLoading(true)
      await gamesApi.updateAnnouncementChannel(
        selectedGame.gameId, 
        announcementChannelId.trim() || undefined, 
        announcementWebhookUrl.trim() || undefined
      )
      toast.success('Announcement settings updated!')
      onRefresh()
    } catch (error) {
      console.error('Failed to update announcement settings:', error)
      toast.error('Failed to update announcement settings')
    } finally {
      setLoading(false)
    }
  }

  const handleTileClick = async (tileNumber: number) => {
    if (!selectedGame) return
    
    try {
      setLoading(true)
      const tileData = await gamesApi.getTile(selectedGame.gameId, tileNumber)
      setTileEditorDialog({
        isOpen: true,
        tileNumber,
        tileData
      })
    } catch (error) {
      console.error('Failed to load tile data:', error)
      toast.error('Failed to load tile data')
    } finally {
      setLoading(false)
    }
  }

  const handleTileUpdate = async (tileNumber: number, updates: any) => {
    if (!selectedGame) return
    
    try {
      setLoading(true)
      
      // Update tile task if provided
      if (updates.task) {
        await gamesApi.updateTile(selectedGame.gameId, tileNumber, updates.task)
      }
      
      // Update snake/ladder if provided
      if (updates.snakeLadder) {
        await gamesApi.updateTileSnakeLadder(selectedGame.gameId, tileNumber, updates.snakeLadder)
      }
      
      toast.success('Tile updated successfully!')
      setBoardImageKey(Date.now()) // Refresh board image
      onRefresh() // Refresh game data
      setTileEditorDialog({ isOpen: false, tileNumber: null, tileData: null })
    } catch (error) {
      console.error('Failed to update tile:', error)
      toast.error('Failed to update tile')
    } finally {
      setLoading(false)
    }
  }

  const handleDragStart = (e: React.DragEvent, member: any, teamId: string) => {
    setDraggedMember({ ...member, sourceTeamId: teamId })
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, targetTeamId: string) => {
    e.preventDefault()
    if (draggedMember && draggedMember.sourceTeamId !== targetTeamId) {
      handleTeamMemberExchange(draggedMember.sourceTeamId, targetTeamId, draggedMember)
    }
    setDraggedMember(null)
  }

  const tabConfig = {
    'games': { icon: Gamepad2, label: 'Game Management', count: games.length },
    'teams': { icon: Users, label: 'Team Management', count: teams.length },
    'applications': { icon: Send, label: 'Applications', count: applications.filter(a => a.status === 'pending').length },
    'board': { icon: Eye, label: 'Board Viewer', count: selectedGame ? 1 : 0 },
    'editor': { icon: Settings, label: 'Board Editor', count: selectedGame ? 1 : 0 }
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white">
              Admin Dashboard
            </h1>
            {process.env.NEXT_PUBLIC_DEV_MODE === 'true' && (
              <span className="bg-red-600 text-red-100 px-2 py-1 rounded-md text-sm font-medium">
                🛡️ DEV: Admin View
              </span>
            )}
          </div>
          <p className="text-gray-300">
            Welcome back, {user.name}! Manage games, teams, and monitor all activities.
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-blue-600/20 border border-blue-600/50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Gamepad2 className="w-8 h-8 text-blue-400" />
              <div>
                <div className="text-2xl font-bold text-white">{stats.totalGames}</div>
                <div className="text-sm text-blue-300">Total Games</div>
              </div>
            </div>
          </div>
          <div className="bg-green-600/20 border border-green-600/50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Play className="w-8 h-8 text-green-400" />
              <div>
                <div className="text-2xl font-bold text-white">{stats.activeGames}</div>
                <div className="text-sm text-green-300">Active Games</div>
              </div>
            </div>
          </div>
          <div className="bg-yellow-600/20 border border-yellow-600/50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-yellow-400" />
              <div>
                <div className="text-2xl font-bold text-white">{stats.registrationGames}</div>
                <div className="text-sm text-yellow-300">Registration Open</div>
              </div>
            </div>
          </div>
          <div className="bg-purple-600/20 border border-purple-600/50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-purple-400" />
              <div>
                <div className="text-2xl font-bold text-white">{stats.totalTeams}</div>
                <div className="text-sm text-purple-300">Total Teams</div>
              </div>
            </div>
          </div>
          <div className="bg-orange-600/20 border border-orange-600/50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-orange-400" />
              <div>
                <div className="text-2xl font-bold text-white">{stats.pendingApplications}</div>
                <div className="text-sm text-orange-300">Pending Apps</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-800/50 p-1 rounded-lg mb-6">
          {Object.entries(tabConfig).map(([key, config]) => {
            const Icon = config.icon
            const isActive = activeTab === key
            
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key as any)}
                className={`flex items-center px-4 py-2 rounded-md transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700'
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {config.label}
                <span className="ml-2 bg-gray-600 px-2 py-1 rounded-full text-xs">
                  {config.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6">
          {activeTab === 'games' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Game Management</h2>
                <button
                  onClick={() => window.open('/create-game', '_blank')}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create New Game
                </button>
              </div>
              
              {games.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Gamepad2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No games created yet.</p>
                  <p className="text-sm mt-2">Create your first game to get started!</p>
                </div>
              ) : (
                <div className="grid gap-6">
                  {games.map((game) => {
                    const gameTeamsCount = teams.filter(t => t.gameId === game.gameId).length
                    const gameAppsCount = applications.filter(a => a.gameId === game.gameId && a.status === 'pending').length
                    const acceptedAppsCount = applications.filter(a => a.gameId === game.gameId && a.status === 'accepted').length
                    const isDevMode = localStorage.getItem('devMode') === 'true'
                    
                    return (
                      <div key={game.gameId} className="bg-gray-700/50 rounded-lg p-6 border border-gray-600">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-xl font-semibold text-white">
                                {game.name}
                              </h3>
                              <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                                game.status === 'active' ? 'bg-green-600 text-white' :
                                game.status === 'registration' ? 'bg-blue-600 text-white' :
                                game.status === 'completed' ? 'bg-purple-600 text-white' :
                                'bg-gray-600 text-white'
                              }`}>
                                {game.status === 'active' && <Play className="w-3 h-3 inline mr-1" />}
                                {game.status === 'registration' && <Users className="w-3 h-3 inline mr-1" />}
                                {game.status === 'completed' && <Trophy className="w-3 h-3 inline mr-1" />}
                                {game.status}
                              </div>
                              {gameAppsCount > 0 && (
                                <div className="bg-orange-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                                  {gameAppsCount} pending
                                </div>
                              )}
                              {/* Show accepted count and readiness for game start */}
                              {game.status === 'registration' && (
                                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  (!isDevMode && acceptedAppsCount < 2) ? 'bg-yellow-600 text-white' :
                                  acceptedAppsCount === 0 ? 'bg-red-600 text-white' :
                                  'bg-green-600 text-white'
                                }`}>
                                  {acceptedAppsCount} accepted
                                  {!isDevMode && acceptedAppsCount < 2 && acceptedAppsCount > 0 && ' (need 2+)'}
                                  {acceptedAppsCount === 0 && ' (need some)'}
                                </div>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                              <div className="bg-gray-800/50 rounded p-3">
                                <div className="text-sm text-gray-300">Teams</div>
                                <div className="text-lg font-bold text-white">{gameTeamsCount}</div>
                              </div>
                              <div className="bg-gray-800/50 rounded p-3">
                                <div className="text-sm text-gray-300">Max Team Size</div>
                                <div className="text-lg font-bold text-white">{game.maxTeamSize}</div>
                              </div>
                              <div className="bg-gray-800/50 rounded p-3">
                                <div className="text-sm text-gray-300">Accepted</div>
                                <div className={`text-lg font-bold ${
                                  acceptedAppsCount === 0 ? 'text-red-400' :
                                  (!isDevMode && acceptedAppsCount < 2) ? 'text-yellow-400' :
                                  'text-green-400'
                                }`}>
                                  {acceptedAppsCount}
                                </div>
                              </div>
                              <div className="bg-gray-800/50 rounded p-3">
                                <div className="text-sm text-gray-300">Snakes</div>
                                <div className="text-lg font-bold text-yellow-400">{game.snakeCount || 0}</div>
                              </div>
                              <div className="bg-gray-800/50 rounded p-3">
                                <div className="text-sm text-gray-300">Ladders</div>
                                <div className="text-lg font-bold text-purple-400">{game.ladderCount || 0}</div>
                              </div>
                            </div>
                            
                            {game.applicationDeadline && (
                              <div className="text-sm text-gray-300 mb-2">
                                <Calendar className="w-4 h-4 inline mr-1" />
                                Deadline: {new Date(game.applicationDeadline).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex flex-col gap-2 ml-4">
                            <button
                              onClick={() => {
                                setSelectedGame(game)
                                setActiveTab('board')
                              }}
                              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded text-sm transition-colors flex items-center gap-2"
                            >
                              <Eye className="w-4 h-4" />
                              View Board
                            </button>
                            
                            <button
                              onClick={() => {
                                setSelectedGame(game)
                                setActiveTab('editor')
                              }}
                              className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded text-sm transition-colors flex items-center gap-2"
                            >
                              <Settings className="w-4 h-4" />
                              Edit Board
                            </button>
                            
                            {game.status === 'pending' && (
                              <button
                                onClick={() => handleGameAction(game.gameId, 'start-registration')}
                                disabled={loading}
                                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm transition-colors flex items-center gap-2"
                              >
                                <Users className="w-4 h-4" />
                                Start Registration
                              </button>
                            )}
                            
                            {game.status === 'registration' && (
                              <button
                                onClick={() => handleGameAction(game.gameId, 'start-game')}
                                disabled={loading}
                                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm transition-colors flex items-center gap-2"
                              >
                                <Play className="w-4 h-4" />
                                Start Game
                              </button>
                            )}
                            
                            {(game.status === 'active' || game.status === 'completed') && (
                              <button
                                onClick={() => handleGameAction(game.gameId, 'reset')}
                                disabled={loading}
                                className="bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm transition-colors flex items-center gap-2"
                              >
                                <RotateCcw className="w-4 h-4" />
                                Reset Game
                              </button>
                            )}
                            
                            <button
                              onClick={() => handleGameAction(game.gameId, 'delete')}
                              disabled={loading}
                              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm transition-colors flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'teams' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Team Management</h2>
                {selectedGame && selectedGame.status !== 'active' && (
                  <button
                    onClick={() => setTeamManagementMode(!teamManagementMode)}
                    className={`px-4 py-2 rounded font-medium transition-colors ${
                      teamManagementMode 
                        ? 'bg-green-600 hover:bg-green-700 text-white' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {teamManagementMode ? 'Exit Team Management' : 'Manage Teams'}
                  </button>
                )}
              </div>
              
              {selectedGame && selectedGame.status !== 'active' && (
                <div className="bg-gray-700/50 rounded-lg p-4 mb-6 border border-gray-600">
                  <h3 className="text-lg font-semibold text-white mb-3">Announcement Settings</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Discord Channel ID</label>
                      <input
                        type="text"
                        placeholder="Enter Discord channel ID"
                        value={announcementChannelId}
                        onChange={(e) => setAnnouncementChannelId(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-400"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Discord Webhook URL</label>
                      <input
                        type="url"
                        placeholder="https://discord.com/api/webhooks/..."
                        value={announcementWebhookUrl}
                        onChange={(e) => setAnnouncementWebhookUrl(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-400"
                      />
                    </div>
                    
                    <button
                      onClick={handleAnnouncementChannelUpdate}
                      disabled={loading}
                      className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded font-medium transition-colors"
                    >
                      {loading ? 'Updating...' : 'Update Announcement Settings'}
                    </button>
                  </div>
                  
                  <div className="mt-3 space-y-1">
                    <p className="text-sm text-gray-400">
                      Set the Discord channel and webhook for team roll announcements.
                    </p>
                    {selectedGame.announcementChannelId && (
                      <p className="text-sm text-green-400">
                        ✅ Channel: {selectedGame.announcementChannelId}
                      </p>
                    )}
                    {selectedGame.announcementWebhookUrl && (
                      <p className="text-sm text-green-400">
                        ✅ Webhook: Configured
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {teamManagementMode && selectedGame && selectedGame.status !== 'active' && (
                <div className="bg-blue-900/20 border border-blue-600/50 rounded-lg p-4 mb-6">
                  <h3 className="text-lg font-semibold text-blue-400 mb-2">Team Management Mode</h3>
                  <p className="text-sm text-gray-300">
                    Drag and drop team members between teams to reorganize before starting the game.
                    Members can only be moved between teams, not removed entirely.
                  </p>
                </div>
              )}
              
              {(gameTeams.length === 0 && selectedGame) || (teams.length === 0 && !selectedGame) ? (
                <div className="text-center py-12 text-gray-400">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No teams found.</p>
                  <p className="text-sm mt-2">Teams will appear here once players start forming teams in active games.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Game Filter */}
                  <div className="flex gap-2 mb-4">
                    <select
                      value={selectedGame?.gameId || ''}
                      onChange={(e) => {
                        const game = games.find(g => g.gameId === e.target.value)
                        setSelectedGame(game || null)
                      }}
                      className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                    >
                      <option value="">All Games</option>
                      {games.map(game => (
                        <option key={game.gameId} value={game.gameId}>
                          {game.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Teams List */}
                  {(selectedGame ? gameTeams : teams).map((team) => {
                    const game = games.find(g => g.gameId === team.gameId)
                    
                    return (
                      <div 
                        key={team.teamId} 
                        className={`bg-gray-700/50 rounded-lg p-6 border ${
                          teamManagementMode && selectedGame && selectedGame.status !== 'active'
                            ? 'border-blue-500/50 hover:border-blue-400'
                            : 'border-gray-600'
                        }`}
                        onDragOver={teamManagementMode ? handleDragOver : undefined}
                        onDrop={teamManagementMode ? (e) => handleDrop(e, team.teamId) : undefined}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold text-white">
                                {team.teamName}
                              </h3>
                              <span className="text-sm text-gray-400">
                                in {game?.name || 'Unknown Game'}
                              </span>
                              <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                                team.canRoll ? 'bg-green-600 text-white' : 'bg-yellow-600 text-white'
                              }`}>
                                {team.canRoll ? '✓ Verified' : '⏳ Pending'}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-4 mb-4">
                              <div className="bg-gray-800/50 rounded p-3">
                                <div className="text-sm text-gray-300">Position</div>
                                <div className="text-lg font-bold text-white">{team.currentPosition}/100</div>
                              </div>
                              <div className="bg-gray-800/50 rounded p-3">
                                <div className="text-sm text-gray-300">Members</div>
                                <div className="text-lg font-bold text-white">
                                  {1 + (team.coLeader ? 1 : 0) + (team.members?.length || 0)}
                                </div>
                              </div>
                              <div className="bg-gray-800/50 rounded p-3">
                                <div className="text-sm text-gray-300">Status</div>
                                <div className={`text-sm font-bold ${
                                  game?.status === 'active' ? 'text-green-400' : 'text-yellow-400'
                                }`}>
                                  {game?.status || 'Unknown'}
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className={`flex items-center gap-2 ${
                                teamManagementMode && selectedGame && selectedGame.status !== 'active'
                                  ? 'cursor-move p-2 rounded hover:bg-gray-600/50'
                                  : ''
                              }`}
                                draggable={!!(teamManagementMode && selectedGame && selectedGame.status !== 'active')}
                                onDragStart={teamManagementMode ? (e) => handleDragStart(e, team.leader, team.teamId) : undefined}
                              >
                                <Crown className="w-4 h-4 text-yellow-400" />
                                <span className="text-white font-medium">{team.leader.displayName}</span>
                                <span className="text-xs text-yellow-400 bg-yellow-400/20 px-2 py-1 rounded">Leader</span>
                                {teamManagementMode && selectedGame && selectedGame.status !== 'active' && (
                                  <span className="text-xs text-blue-400 ml-auto">Drag to move</span>
                                )}
                              </div>
                              {team.coLeader && (
                                <div className={`flex items-center gap-2 ${
                                  teamManagementMode && selectedGame && selectedGame.status !== 'active'
                                    ? 'cursor-move p-2 rounded hover:bg-gray-600/50'
                                    : ''
                                }`}
                                  draggable={!!(teamManagementMode && selectedGame && selectedGame.status !== 'active')}
                                  onDragStart={teamManagementMode ? (e) => handleDragStart(e, team.coLeader, team.teamId) : undefined}
                                >
                                  <Award className="w-4 h-4 text-orange-400" />
                                  <span className="text-white font-medium">{team.coLeader.displayName}</span>
                                  <span className="text-xs text-orange-400 bg-orange-400/20 px-2 py-1 rounded">Co-Leader</span>
                                  {teamManagementMode && selectedGame && selectedGame.status !== 'active' && (
                                    <span className="text-xs text-blue-400 ml-auto">Drag to move</span>
                                  )}
                                </div>
                              )}
                              {team.members?.map((member: any, index: number) => (
                                <div 
                                  key={index} 
                                  className={`flex items-center gap-2 ${
                                    teamManagementMode && selectedGame && selectedGame.status !== 'active'
                                      ? 'cursor-move p-2 rounded hover:bg-gray-600/50'
                                      : ''
                                  }`}
                                  draggable={!!(teamManagementMode && selectedGame && selectedGame.status !== 'active')}
                                  onDragStart={teamManagementMode ? (e) => handleDragStart(e, member, team.teamId) : undefined}
                                >
                                  <Target className="w-4 h-4 text-gray-400" />
                                  <span className="text-gray-300">{member.displayName}</span>
                                  <span className="text-xs text-gray-400 bg-gray-400/20 px-2 py-1 rounded">Member</span>
                                  {teamManagementMode && selectedGame && selectedGame.status !== 'active' && (
                                    <span className="text-xs text-blue-400 ml-auto">Drag to move</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-2 ml-4">
                            {game?.status === 'active' && (
                              <>
                                <button
                                  onClick={() => handleTeamVerification(team.teamId, !team.canRoll)}
                                  disabled={loading}
                                  className={`px-3 py-2 rounded text-sm transition-colors flex items-center gap-2 ${
                                    team.canRoll
                                      ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                                      : 'bg-green-600 hover:bg-green-700 text-white'
                                  }`}
                                >
                                  {team.canRoll ? (
                                    <>
                                      <XCircle className="w-4 h-4" />
                                      Unverify
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="w-4 h-4" />
                                      Verify
                                    </>
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'applications' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Application Management</h2>
              
              {applications.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Send className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No applications found.</p>
                  <p className="text-sm mt-2">Applications will appear here when players apply to join games.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Filter by status */}
                  <div className="flex gap-2 mb-4">
                    <button 
                      onClick={() => setApplicationFilter('all')}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        applicationFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      All ({applications.length})
                    </button>
                    <button 
                      onClick={() => setApplicationFilter('pending')}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        applicationFilter === 'pending' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Pending ({applications.filter(a => a.status === 'pending').length})
                    </button>
                    <button 
                      onClick={() => setApplicationFilter('accepted')}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        applicationFilter === 'accepted' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Accepted ({applications.filter(a => a.status === 'accepted').length})
                    </button>
                    <button 
                      onClick={() => setApplicationFilter('rejected')}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        applicationFilter === 'rejected' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Rejected ({applications.filter(a => a.status === 'rejected').length})
                    </button>
                  </div>

                  {applications
                    .filter(app => applicationFilter === 'all' || app.status === applicationFilter)
                    .map((application) => {
                    const game = games.find(g => g.gameId === application.gameId)
                    
                    return (
                      <div key={application.applicationId} className="bg-gray-700/50 rounded-lg p-6 border border-gray-600">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold text-white">
                                {application.displayName}
                              </h3>
                              <span className="text-sm text-gray-400">
                                wants to join {game?.name || 'Unknown Game'}
                              </span>
                              <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                                application.status === 'pending' ? 'bg-yellow-600 text-white' :
                                application.status === 'accepted' ? 'bg-green-600 text-white' :
                                'bg-red-600 text-white'
                              }`}>
                                {application.status === 'pending' && <Clock className="w-3 h-3 inline mr-1" />}
                                {application.status === 'accepted' && <CheckCircle className="w-3 h-3 inline mr-1" />}
                                {application.status === 'rejected' && <XCircle className="w-3 h-3 inline mr-1" />}
                                {application.status}
                              </div>
                            </div>
                            
                            <div className="text-sm text-gray-300 space-y-1">
                              <p>Username: {application.username}</p>
                              <p>Applied: {new Date(application.appliedAt).toLocaleDateString()}</p>
                              {application.reviewedAt && (
                                <p>Reviewed: {new Date(application.reviewedAt).toLocaleDateString()}</p>
                              )}
                            </div>
                            
                            {application.notes && (
                              <div className="mt-3 p-3 bg-gray-600/50 rounded">
                                <p className="text-sm text-gray-300">
                                  <strong>Notes:</strong> {application.notes}
                                </p>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex flex-col gap-2 ml-4">
                            {/* Status Change Dropdown */}
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-300">Change to:</span>
                              <select
                                value={application.status}
                                onChange={(e) => {
                                  const newStatus = e.target.value as 'pending' | 'accepted' | 'rejected'
                                  if (newStatus !== application.status) {
                                    handleApplicationStatusChange(application.applicationId, newStatus)
                                  }
                                }}
                                disabled={loading}
                                className="bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm text-white disabled:opacity-50"
                              >
                                <option value="pending">Pending</option>
                                <option value="accepted">Accepted</option>
                                <option value="rejected">Rejected</option>
                              </select>
                            </div>
                            
                            {/* Quick Action Buttons for Pending Applications */}
                            {application.status === 'pending' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleApplicationAction(application.applicationId, 'accept')}
                                  disabled={loading}
                                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm transition-colors flex items-center gap-2"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Accept
                                </button>
                                <button
                                  onClick={() => handleApplicationAction(application.applicationId, 'reject')}
                                  disabled={loading}
                                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm transition-colors flex items-center gap-2"
                                >
                                  <XCircle className="w-4 h-4" />
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Board View Tab */}
          {activeTab === 'board' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Board Viewer & Game Monitor</h2>
                {selectedGame && (
                  <div className="text-sm text-gray-300">
                    Monitoring: {selectedGame.name}
                  </div>
                )}
              </div>

              {!selectedGame ? (
                <div className="text-center py-12">
                  <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-300 mb-2">No game selected</p>
                  <p className="text-sm text-gray-400">Go to "Game Management" and click "View Board" on any game</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Admin Controls */}
                  <div className="bg-red-600/20 border border-red-600/50 rounded-lg p-6">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                      <Shield className="w-5 h-5" />
                      Admin Controls
                    </h3>
                    
                    <div className="flex gap-3">
                      {selectedGame.status === 'pending' && (
                        <button
                          onClick={() => handleGameAction(selectedGame.gameId, 'start-registration')}
                          disabled={loading}
                          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded transition-colors flex items-center gap-2"
                        >
                          <Users className="w-4 h-4" />
                          Start Registration
                        </button>
                      )}
                      
                      {selectedGame.status === 'registration' && (
                        <button
                          onClick={() => handleGameAction(selectedGame.gameId, 'start-game')}
                          disabled={loading}
                          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded transition-colors flex items-center gap-2"
                        >
                          <Play className="w-4 h-4" />
                          Start Game
                        </button>
                      )}
                      
                      {(selectedGame.status === 'active' || selectedGame.status === 'completed') && (
                        <button
                          onClick={() => handleGameAction(selectedGame.gameId, 'reset')}
                          disabled={loading}
                          className="bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white px-4 py-2 rounded transition-colors flex items-center gap-2"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Reset Game
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleGameAction(selectedGame.gameId, 'delete')}
                        disabled={loading}
                        className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded transition-colors flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Game
                      </button>
                    </div>
                  </div>

                  {/* Game Stats */}
                  <div className="bg-gray-700/50 rounded-lg p-6">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      Game Statistics
                    </h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-white">{gameTeams.length}</div>
                        <div className="text-sm text-gray-300">Total Teams</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-400">
                          {gameTeams.filter(t => t.canRoll).length}
                        </div>
                        <div className="text-sm text-gray-300">Verified Teams</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-400">
                          {selectedGame.snakeCount || 0}
                        </div>
                        <div className="text-sm text-gray-300">Snakes</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-400">
                          {selectedGame.ladderCount || 0}
                        </div>
                        <div className="text-sm text-gray-300">Ladders</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-400">
                          {gameApplications.filter(a => a.status === 'pending').length}
                        </div>
                        <div className="text-sm text-gray-300">Pending Apps</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-400">
                          {gameApplications.filter(a => a.status === 'accepted').length}
                        </div>
                        <div className="text-sm text-gray-300">Accepted Apps</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-white">
                          {selectedGame.maxTeamSize}
                        </div>
                        <div className="text-sm text-gray-300">Max Team Size</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-cyan-400">
                          {Math.max(...gameTeams.map(t => t.currentPosition), 0)}
                        </div>
                        <div className="text-sm text-gray-300">Furthest Position</div>
                      </div>
                    </div>
                  </div>

                  {/* Teams Management */}
                  <div className="bg-gray-700/50 rounded-lg p-6">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                      <Trophy className="w-5 h-5" />
                      Team Leaderboard & Verification
                    </h3>
                    
                    {loading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                        <p className="text-gray-300 mt-2">Loading teams...</p>
                      </div>
                    ) : gameTeams.length === 0 ? (
                      <p className="text-gray-300 text-center py-8">No teams found for this game</p>
                    ) : (
                      <div className="space-y-3">
                        {gameTeams
                          .sort((a, b) => b.currentPosition - a.currentPosition)
                          .map((team, index) => (
                            <div
                              key={team.teamId}
                              className="flex items-center justify-between p-4 rounded-lg bg-gray-800/50"
                            >
                              <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                                  index === 0 ? 'bg-yellow-500 text-black' :
                                  index === 1 ? 'bg-gray-400 text-black' :
                                  index === 2 ? 'bg-orange-600 text-white' :
                                  'bg-gray-600 text-white'
                                }`}>
                                  {index + 1}
                                </div>
                                <div>
                                  <div className="font-medium text-white flex items-center gap-2">
                                    {team.teamName}
                                    {team.canRoll ? (
                                      <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">VERIFIED</span>
                                    ) : (
                                      <span className="text-xs bg-yellow-600 text-white px-2 py-1 rounded">PENDING</span>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-300">
                                    Leader: {team.leader.displayName} | Members: {1 + (team.coLeader ? 1 : 0) + (team.members?.length || 0)}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <div className="text-lg font-bold text-white">
                                    Position {team.currentPosition}
                                  </div>
                                </div>
                                
                                {selectedGame.status === 'active' && (
                                  <button
                                    onClick={() => handleTeamVerification(team.teamId, !team.canRoll)}
                                    disabled={loading}
                                    className={`px-3 py-2 rounded text-sm transition-colors flex items-center gap-2 ${
                                      team.canRoll
                                        ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                                        : 'bg-green-600 hover:bg-green-700 text-white'
                                    }`}
                                  >
                                    {team.canRoll ? (
                                      <>
                                        <XCircle className="w-4 h-4" />
                                        Unverify
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle className="w-4 h-4" />
                                        Verify
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Board Image */}
                  <div className="bg-gray-700/50 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-white">Live Game Board</h3>
                      <button
                        onClick={forceBoardRefresh}
                        disabled={loading || boardLoading}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm transition-colors flex items-center gap-2"
                      >
                        <RotateCcw className={`w-4 h-4 ${boardLoading ? 'animate-spin' : ''}`} />
                        {boardLoading ? 'Refreshing...' : 'Refresh Board'}
                      </button>
                    </div>
                    <div className="flex justify-center">
                      <img
                        src={`${process.env.NEXT_PUBLIC_API_URL}/api/games/${selectedGame.gameId}/board?t=${boardImageKey}`}
                        alt={`${selectedGame.name} Board`}
                        className="max-w-full h-auto rounded-lg border border-gray-600"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                          target.parentElement!.innerHTML = '<div class="text-gray-400 text-center py-8">Board image not available</div>'
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 text-center mt-2 flex items-center justify-center gap-2">
                      <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                      Board updates automatically every 10 seconds when teams move
                      {boardLoading && <span className="text-blue-400">(Updating...)</span>}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Board Editor Tab */}
          {activeTab === 'editor' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Board Editor</h2>
                {selectedGame && (
                  <div className="text-sm text-gray-300">
                    Editing: {selectedGame.name}
                  </div>
                )}
              </div>

              {!selectedGame ? (
                <div className="text-center py-12">
                  <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-300 mb-2">No game selected</p>
                  <p className="text-sm text-gray-400">Go to "Game Management" and select a game to edit its board</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Instructions */}
                  <div className="bg-blue-600/20 border border-blue-600/50 rounded-lg p-6">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      Board Editor Instructions
                    </h3>
                    <div className="text-gray-300 space-y-2">
                      <p>• Click on any tile below to edit its content</p>
                      <p>• You can change the tile description, image, and add/remove snakes or ladders</p>
                      <p>• Changes are saved immediately and will be reflected in the game</p>
                      <p>• The board image will automatically update after changes</p>
                    </div>
                  </div>

                  {/* Board Tiles Grid */}
                  <div className="bg-gray-700/50 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-white">Board Tiles</h3>
                      <div className="text-sm text-gray-300">
                        10x10 board (100 tiles)
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-10 gap-1 max-w-4xl mx-auto">
                      {Array.from({ length: 100 }, (_, i) => {
                        // Calculate tile number starting from bottom-left (like Snakes and Ladders)
                        const row = Math.floor(i / 10)
                        const col = i % 10
                        const boardRow = 9 - row // Flip the row (bottom to top)
                        
                        // Snake-like pattern: odd rows go right-to-left, even rows go left-to-right
                        let tileNumber: number
                        if (boardRow % 2 === 0) {
                          // Even rows (0, 2, 4, 6, 8): left to right
                          tileNumber = boardRow * 10 + col + 1
                        } else {
                          // Odd rows (1, 3, 5, 7, 9): right to left
                          tileNumber = boardRow * 10 + (9 - col) + 1
                        }
                        
                        const isSnake = selectedGame.snakes && selectedGame.snakes[tileNumber.toString()]
                        const isLadder = selectedGame.ladders && selectedGame.ladders[tileNumber.toString()]
                        const hasTeam = gameTeams.some(t => t.currentPosition === tileNumber)
                        
                        return (
                          <button
                            key={i}
                            onClick={() => handleTileClick(tileNumber)}
                            disabled={loading}
                            className={`
                              aspect-square rounded-lg text-xs font-bold transition-all
                              ${hasTeam ? 'bg-yellow-600 text-white' : 'bg-gray-600 text-gray-300'}
                              ${isSnake ? 'ring-2 ring-red-500' : ''}
                              ${isLadder ? 'ring-2 ring-green-500' : ''}
                              hover:bg-blue-600 hover:text-white
                              disabled:opacity-50 disabled:cursor-not-allowed
                              flex items-center justify-center
                            `}
                          >
                            {tileNumber}
                          </button>
                        )
                      })}
                    </div>
                    
                    {/* Legend */}
                    <div className="flex items-center justify-center gap-6 mt-6 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gray-600 rounded"></div>
                        <span className="text-gray-300">Empty tile</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-yellow-600 rounded"></div>
                        <span className="text-gray-300">Team position</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gray-600 rounded ring-2 ring-red-500"></div>
                        <span className="text-gray-300">Snake head</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gray-600 rounded ring-2 ring-green-500"></div>
                        <span className="text-gray-300">Ladder bottom</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Team Distribution Dialog */}
        {teamDistributionDialog.isOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                  <Users className="w-6 h-6 text-blue-400" />
                  Team Distribution Preview
                </h3>
                <p className="text-gray-300">
                  Review and edit team assignments before starting the game. You can drag and drop members between teams.
                </p>
              </div>
              
              <div className="p-6">
                <TeamDistributionEditor
                  teams={teamDistributionDialog.distributedTeams}
                  onChange={(updatedTeams) => {
                    setTeamDistributionDialog(prev => ({
                      ...prev,
                      distributedTeams: updatedTeams
                    }))
                  }}
                />
                
                <div className="flex gap-3 mt-6 pt-6 border-t border-gray-700">
                  <button
                    onClick={async () => {
                      try {
                        setLoading(true)
                        await gamesApi.startGameWithTeams(
                          teamDistributionDialog.gameData.gameId, 
                          teamDistributionDialog.distributedTeams
                        )
                        toast.success('Game started with custom teams!')
                        setTeamDistributionDialog({
                          isOpen: false,
                          distributedTeams: [],
                          gameData: null
                        })
                        onRefresh()
                      } catch (error: any) {
                        console.error('Start game with teams failed:', error)
                        const errorMessage = error.response?.data?.error || 'Failed to start game'
                        toast.error(errorMessage)
                      } finally {
                        setLoading(false)
                      }
                    }}
                    disabled={loading}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-3 px-6 rounded transition-colors flex items-center justify-center gap-2"
                  >
                    <Play className="w-5 h-5" />
                    {loading ? 'Starting Game...' : 'Start Game with These Teams'}
                  </button>
                  <button
                    onClick={() => setTeamDistributionDialog({
                      isOpen: false,
                      distributedTeams: [],
                      gameData: null
                    })}
                    disabled={loading}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white py-3 px-6 rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tile Editor Dialog */}
        {tileEditorDialog.isOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                  <Settings className="w-6 h-6 text-blue-400" />
                  Edit Tile {tileEditorDialog.tileNumber}
                </h3>
                <p className="text-gray-300">
                  Edit the content and properties of this tile
                </p>
              </div>
              
              <div className="p-6">
                <TileEditor
                  tileNumber={tileEditorDialog.tileNumber!}
                  initialData={tileEditorDialog.tileData}
                  onSave={handleTileUpdate}
                  onCancel={() => setTileEditorDialog({ isOpen: false, tileNumber: null, tileData: null })}
                  loading={loading}
                />
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Dialog */}
        {confirmDialog.isOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                {confirmDialog.type === 'danger' && <AlertTriangle className="w-5 h-5 text-red-400" />}
                {confirmDialog.type === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-400" />}
                {confirmDialog.type === 'info' && <Zap className="w-5 h-5 text-blue-400" />}
                {confirmDialog.title}
              </h3>
              <p className="text-gray-300 mb-6">{confirmDialog.message}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    confirmDialog.action()
                    setConfirmDialog({ ...confirmDialog, isOpen: false })
                  }}
                  className={`flex-1 py-2 px-4 rounded transition-colors ${
                    confirmDialog.type === 'danger' ? 'bg-red-600 hover:bg-red-700' :
                    confirmDialog.type === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700' :
                    'bg-blue-600 hover:bg-blue-700'
                  } text-white`}
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
