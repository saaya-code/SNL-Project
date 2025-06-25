'use client'

import { useState, useEffect } from 'react'
import { Game, Team, Application, User } from '@/types/index'
import { 
  Users, 
  Gamepad2, 
  Plus,
  Dice6,
  Trophy,
  Clock,
  Send,
  Eye,
  MapPin,
  TrendingUp,
  RotateCcw,
  Award,
  Play,
  Target,
  Crown,
  Zap
} from 'lucide-react'
import { teamsApi, applicationsApi, gamesApi } from '@/lib/api'
import { toast } from 'react-hot-toast'

interface PlayerDashboardProps {
  games: Game[]
  teams: Team[]
  applications: Application[]
  user: User
  onRefresh: () => void
}

export default function PlayerDashboard({ 
  games, 
  teams, 
  applications, 
  user, 
  onRefresh 
}: PlayerDashboardProps) {
  const [activeTab, setActiveTab] = useState<'my-games' | 'available-games' | 'applications' | 'board'>('my-games')
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [gameTeams, setGameTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(false)
  const [boardImageKey, setBoardImageKey] = useState<number>(Date.now())
  const [boardLoading, setBoardLoading] = useState(false)

  // Filter data for current user
  const myTeams = teams.filter(team => 
    team.members?.some((member: any) => member.userId === user.id) ||
    team.leader.userId === user.id ||
    (team.coLeader && team.coLeader.userId === user.id)
  )
  
  const myGames = games.filter(game => 
    myTeams.some(team => team.gameId === game.gameId)
  )
  
  const availableGames = games.filter(game => 
    game.status === 'registration' && 
    !myTeams.some(team => team.gameId === game.gameId) &&
    !applications.some(app => app.gameId === game.gameId && app.userId === user.id)
  )

  // Load team data for selected game
  useEffect(() => {
    if (selectedGame) {
      loadGameTeams(selectedGame.gameId)
    }
  }, [selectedGame])

  const loadGameTeams = async (gameId: string) => {
    try {
      setLoading(true)
      const teamsData = await teamsApi.getByGame(gameId)
      setGameTeams(teamsData)
    } catch (error) {
      console.error('Error loading game teams:', error)
      toast.error('Failed to load game teams')
    } finally {
      setLoading(false)
    }
  }

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
      loadGameTeams(selectedGame.gameId)
    }
  }

  const getUserTeamForGame = (gameId: string) => {
    return myTeams.find(team => team.gameId === gameId)
  }

  const getUserRoleInTeam = (team: Team) => {
    if (team.leader.userId === user.id) return 'Leader'
    if (team.coLeader?.userId === user.id) return 'Co-Leader'
    return 'Member'
  }

  const canUserRoll = (team: Team) => {
    return team.canRoll && (team.leader.userId === user.id || team.coLeader?.userId === user.id)
  }
  
  const myApplications = applications.filter(app => app.userId === user.id)

  const handleRollDice = async (teamId: string) => {
    try {
      setLoading(true)
      const result = await teamsApi.roll(teamId, user.id || '')
      
      toast.success(`Rolled ${result.diceRoll}! Moved from ${result.oldPosition} to ${result.newPosition}${result.snakeOrLadder ? ` (${result.snakeOrLadder})` : ''}`)
      
      // Force board refresh if we're viewing the board
      if (activeTab === 'board') {
        forceBoardRefresh()
      }
      
      onRefresh()
    } catch (error) {
      console.error('Roll dice failed:', error)
      toast.error('Failed to roll dice. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinGame = async (gameId: string) => {
    try {
      setLoading(true)
      // This would create an application for the game
      await applicationsApi.create({
        gameId,
        userId: user.id || '',
        username: user.name || '',
        displayName: user.name || '',
        status: 'pending'
      })
      
      toast.success('Application submitted!')
      onRefresh()
    } catch (error) {
      console.error('Join game failed:', error)
      toast.error('Failed to join game. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getTeamPosition = (team: Team) => {
    const myTeams = teams.filter(t => t.gameId === team.gameId)
    const sortedTeams = myTeams.sort((a, b) => b.currentPosition - a.currentPosition)
    return sortedTeams.findIndex(t => t.teamId === team.teamId) + 1
  }

  const tabConfig = {
    'my-games': { icon: Gamepad2, label: 'My Games', count: myGames.length },
    'available-games': { icon: Plus, label: 'Available Games', count: availableGames.length },
    'applications': { icon: Send, label: 'Applications', count: myApplications.length },
    'board': { icon: Eye, label: 'Board View', count: selectedGame ? 1 : 0 }
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white">
              Player Dashboard
            </h1>
            {process.env.DEV_MODE === 'true' && (
              <span className="bg-green-600 text-green-100 px-2 py-1 rounded-md text-sm font-medium">
                🎮 DEV: Player View
              </span>
            )}
          </div>
          <p className="text-gray-300">
            Welcome back, {user.name}! Ready to play some Snakes & Ladders?
          </p>
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
          {activeTab === 'my-games' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">My Games</h2>
              
              {myGames.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Gamepad2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>You're not in any games yet.</p>
                  <p className="text-sm mt-2">Check the "Available Games" tab to join a game!</p>
                </div>
              ) : (
                <div className="grid gap-6">
                  {myGames.map((game) => {
                    const myTeam = getUserTeamForGame(game.gameId)
                    const userRole = myTeam ? getUserRoleInTeam(myTeam) : ''
                    const canRoll = myTeam ? canUserRoll(myTeam) : false
                    
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
                            </div>
                            
                            {myTeam && (
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div className="bg-gray-800/50 rounded p-3">
                                  <div className="text-sm text-gray-300">Position</div>
                                  <div className="text-lg font-bold text-white">{myTeam.currentPosition}/100</div>
                                </div>
                                <div className="bg-gray-800/50 rounded p-3">
                                  <div className="text-sm text-gray-300">Your Role</div>
                                  <div className="text-sm font-bold text-blue-400">{userRole}</div>
                                </div>
                                <div className="bg-gray-800/50 rounded p-3">
                                  <div className="text-sm text-gray-300">Team</div>
                                  <div className="text-sm font-bold text-white">{myTeam.teamName}</div>
                                </div>
                                <div className="bg-gray-800/50 rounded p-3">
                                  <div className="text-sm text-gray-300">Status</div>
                                  <div className={`text-sm font-bold ${myTeam.canRoll ? 'text-green-400' : 'text-yellow-400'}`}>
                                    {myTeam.canRoll ? 'Can Roll' : 'Waiting'}
                                  </div>
                                </div>
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
                            
                            {myTeam && game.status === 'active' && canRoll && (
                              <button
                                onClick={() => handleRollDice(myTeam.teamId)}
                                disabled={loading}
                                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm transition-colors flex items-center gap-2"
                              >
                                <Dice6 className="w-4 h-4" />
                                {loading ? 'Rolling...' : 'Roll Dice'}
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {myTeam && (
                          <div className="bg-gray-600/50 rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                              <Users className="w-4 h-4" />
                              Team Members
                            </h4>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Crown className="w-4 h-4 text-yellow-400" />
                                <span className="text-white font-medium">{myTeam.leader.displayName}</span>
                                <span className="text-xs text-yellow-400 bg-yellow-400/20 px-2 py-1 rounded">Leader</span>
                              </div>
                              {myTeam.coLeader && (
                                <div className="flex items-center gap-2">
                                  <Award className="w-4 h-4 text-orange-400" />
                                  <span className="text-white font-medium">{myTeam.coLeader.displayName}</span>
                                  <span className="text-xs text-orange-400 bg-orange-400/20 px-2 py-1 rounded">Co-Leader</span>
                                </div>
                              )}
                              {myTeam.members?.map((member: any, index: number) => (
                                <div key={index} className="flex items-center gap-2">
                                  <Target className="w-4 h-4 text-gray-400" />
                                  <span className="text-gray-300">{member.displayName}</span>
                                  <span className="text-xs text-gray-400 bg-gray-400/20 px-2 py-1 rounded">Member</span>
                                </div>
                              ))}
                            </div>
                            
                            {!myTeam.canRoll && game.status === 'active' && (
                              <div className="mt-3 p-2 bg-yellow-600/20 border border-yellow-600/50 rounded text-xs text-yellow-200 flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                {userRole === 'Member' 
                                  ? 'Only team leaders can roll dice' 
                                  : 'Waiting for next round or admin verification'
                                }
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'available-games' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Available Games</h2>
              
              {availableGames.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Plus className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No games available to join right now.</p>
                  <p className="text-sm mt-2">Check back later for new games!</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {availableGames.map((game) => (
                    <div key={game.gameId} className="bg-gray-700/50 rounded-lg p-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-xl font-semibold text-white mb-2">
                            {game.name}
                          </h3>
                          <div className="space-y-1 text-sm text-gray-300">
                            <p>Status: <span className="font-semibold text-yellow-400">Open for Registration</span></p>
                            <p>Max Team Size: {game.maxTeamSize}</p>
                            <p>Participants: {game.participants.length}</p>
                            {game.applicationDeadline && (
                              <p>Deadline: {new Date(game.applicationDeadline).toLocaleDateString()}</p>
                            )}
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handleJoinGame(game.gameId)}
                          disabled={loading || myApplications.some(app => app.gameId === game.gameId)}
                          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          {myApplications.some(app => app.gameId === game.gameId) ? 'Applied' : 'Join Game'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'applications' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">My Applications</h2>
              
              {myApplications.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Send className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No applications submitted yet.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {myApplications.map((application) => (
                    <div key={application.applicationId} className="bg-gray-700/50 rounded-lg p-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-xl font-semibold text-white mb-2">
                            Game Application
                          </h3>
                          <div className="space-y-1 text-sm text-gray-300">
                            <p>Game ID: {application.gameId}</p>
                            <p>Status: <span className={`font-semibold ${
                              application.status === 'pending' ? 'text-yellow-400' :
                              application.status === 'accepted' ? 'text-green-400' : 'text-red-400'
                            }`}>{application.status}</span></p>
                            <p>Applied: {new Date(application.appliedAt).toLocaleDateString()}</p>
                            {application.reviewedAt && (
                              <p>Reviewed: {new Date(application.reviewedAt).toLocaleDateString()}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            application.status === 'pending' ? 'bg-yellow-900 text-yellow-300' :
                            application.status === 'accepted' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                          }`}>
                            {application.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                            {application.status === 'accepted' && <Trophy className="w-3 h-3 mr-1" />}
                            {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
                          </div>
                        </div>
                      </div>
                      
                      {application.notes && (
                        <div className="mt-4 p-3 bg-gray-600/50 rounded">
                          <p className="text-sm text-gray-300">
                            <strong>Notes:</strong> {application.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Board View Tab */}
          {activeTab === 'board' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Game Board</h2>
                {selectedGame && (
                  <div className="text-sm text-gray-300">
                    Viewing: {selectedGame.name}
                  </div>
                )}
              </div>

              {!selectedGame ? (
                <div className="text-center py-12">
                  <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-300 mb-2">No game selected</p>
                  <p className="text-sm text-gray-400">Go to "My Games" and click "View Board" on any game</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Game Stats */}
                  <div className="bg-gray-700/50 rounded-lg p-6">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      Game Overview
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
                        <div className="text-sm text-gray-300">Active Teams</div>
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

                    {/* User's Team Info */}
                    {(() => {
                      const userTeam = getUserTeamForGame(selectedGame.gameId)
                      if (userTeam) {
                        const userRole = getUserRoleInTeam(userTeam)
                        const canRoll = canUserRoll(userTeam)
                        
                        return (
                          <div className="bg-blue-600/20 border border-blue-600/50 rounded-lg p-4">
                            <h4 className="font-medium text-blue-300 mb-2 flex items-center gap-2">
                              <Zap className="w-4 h-4" />
                              Your Team Status
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div>
                                <div className="text-sm text-gray-300">Team</div>
                                <div className="font-bold text-white">{userTeam.teamName}</div>
                              </div>
                              <div>
                                <div className="text-sm text-gray-300">Position</div>
                                <div className="font-bold text-white">{userTeam.currentPosition}/100</div>
                              </div>
                              <div>
                                <div className="text-sm text-gray-300">Your Role</div>
                                <div className="font-bold text-blue-400">{userRole}</div>
                              </div>
                              <div>
                                <div className="text-sm text-gray-300">Can Roll</div>
                                <div className={`font-bold ${canRoll ? 'text-green-400' : 'text-red-400'}`}>
                                  {canRoll ? 'Yes' : 'No'}
                                </div>
                              </div>
                            </div>
                            
                            {canRoll && selectedGame.status === 'active' && (
                              <div className="mt-4">
                                <button
                                  onClick={() => handleRollDice(userTeam.teamId)}
                                  disabled={loading}
                                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded transition-colors flex items-center gap-2"
                                >
                                  <Dice6 className="w-4 h-4" />
                                  {loading ? 'Rolling...' : 'Roll Dice'}
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      }
                      return null
                    })()}
                  </div>

                  {/* Teams Leaderboard */}
                  <div className="bg-gray-700/50 rounded-lg p-6">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                      <Trophy className="w-5 h-5" />
                      Team Leaderboard
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
                          .map((team, index) => {
                            const isUserTeam = getUserTeamForGame(selectedGame.gameId)?.teamId === team.teamId
                            
                            return (
                              <div
                                key={team.teamId}
                                className={`flex items-center justify-between p-4 rounded-lg ${
                                  isUserTeam 
                                    ? 'bg-blue-600/30 border border-blue-600/50' 
                                    : 'bg-gray-800/50'
                                }`}
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
                                      {isUserTeam && (
                                        <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">YOUR TEAM</span>
                                      )}
                                    </div>
                                    <div className="text-sm text-gray-300">
                                      Leader: {team.leader.displayName}
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="text-right">
                                  <div className="text-lg font-bold text-white">
                                    Position {team.currentPosition}
                                  </div>
                                  <div className={`text-sm ${team.canRoll ? 'text-green-400' : 'text-yellow-400'}`}>
                                    {team.canRoll ? '✓ Verified' : '⏳ Waiting'}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
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
        </div>
      </div>
    </div>
  )
}
