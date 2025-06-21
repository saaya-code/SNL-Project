'use client'

import { useState } from 'react'
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
  Trash2
} from 'lucide-react'
import { gamesApi, teamsApi, applicationsApi } from '@/lib/api'
import { toast } from 'react-hot-toast'

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
  const [activeTab, setActiveTab] = useState<'games' | 'teams' | 'applications'>('games')
  const [loading, setLoading] = useState(false)

  const handleGameAction = async (gameId: string, action: string) => {
    try {
      setLoading(true)
      
      switch (action) {
        case 'start':
          await gamesApi.startGame(gameId)
          toast.success('Game started!')
          break
        case 'pause':
          // Pause functionality would need to be implemented
          toast.success('Pause functionality coming soon!')
          break
        case 'reset':
          await gamesApi.resetGame(gameId, 'active')
          toast.success('Game reset!')
          break
        case 'delete':
          if (confirm('Are you sure you want to delete this game?')) {
            await gamesApi.delete(gameId)
            toast.success('Game deleted!')
          }
          break
      }
      
      onRefresh()
    } catch (error) {
      console.error('Game action failed:', error)
      toast.error('Action failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleApplicationAction = async (applicationId: string, action: 'accept' | 'decline') => {
    try {
      setLoading(true)
      
      if (action === 'accept') {
        await applicationsApi.accept(applicationId, user.id || '')
        toast.success('Application accepted!')
      } else {
        await applicationsApi.reject(applicationId, user.id || '')
        toast.success('Application declined!')
      }
      
      onRefresh()
    } catch (error) {
      console.error('Application action failed:', error)
      toast.error('Action failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const createNewGame = async () => {
    try {
      setLoading(true)
      await gamesApi.create({
        name: `Game ${games.length + 1}`,
        status: 'pending',
        maxTeamSize: 4,
        snakeCount: 0,
        ladderCount: 0,
        participants: [],
        createdBy: user.id || '',
        tileTasks: {},
        snakes: {},
        ladders: {}
      })
      toast.success('New game created!')
      onRefresh()
    } catch (error) {
      console.error('Failed to create game:', error)
      toast.error('Failed to create game. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const tabConfig = {
    games: { icon: Gamepad2, label: 'Games', count: games.length },
    teams: { icon: Users, label: 'Teams', count: teams.length },
    applications: { icon: UserCheck, label: 'Applications', count: applications.length }
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Admin Dashboard
          </h1>
          <p className="text-gray-300">
            Welcome back, {user.name}! Manage your Snakes & Ladders games.
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
          {activeTab === 'games' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Games Management</h2>
                <button
                  onClick={createNewGame}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Game
                </button>
              </div>

              <div className="grid gap-4">
                {games.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Gamepad2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No games created yet.</p>
                  </div>
                ) : (
                  games.map((game) => (
                    <div key={game.gameId} className="bg-gray-700/50 rounded-lg p-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-xl font-semibold text-white mb-2">
                            {game.name || `Game ${game.gameId}`}
                          </h3>
                          <div className="space-y-1 text-sm text-gray-300">
                            <p>Status: <span className={`font-semibold ${
                              game.status === 'active' ? 'text-green-400' :
                              game.status === 'pending' ? 'text-yellow-400' : 'text-gray-400'
                            }`}>{game.status}</span></p>
                            <p>Participants: {game.participants?.length || 0}</p>
                            <p>Created by: {game.createdBy}</p>
                          </div>
                        </div>
                        
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleGameAction(game.gameId, game.status === 'active' ? 'pause' : 'start')}
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 rounded"
                          >
                            {game.status === 'active' ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleGameAction(game.gameId, 'reset')}
                            disabled={loading}
                            className="bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white px-3 py-2 rounded"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleGameAction(game.gameId, 'delete')}
                            disabled={loading}
                            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-2 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      {game.participants && game.participants.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-600">
                          <h4 className="text-sm font-semibold text-gray-300 mb-2">Participants:</h4>
                          <div className="flex flex-wrap gap-2">
                            {game.participants.map((participantId: string, index: number) => (
                              <span key={index} className="bg-gray-600 text-white px-2 py-1 rounded text-xs">
                                {participantId}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'teams' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Teams Management</h2>
              <div className="grid gap-4">
                {teams.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No teams found.</p>
                  </div>
                ) : (
                  teams.map((team) => (
                    <div key={team.teamId} className="bg-gray-700/50 rounded-lg p-6">
                      <h3 className="text-xl font-semibold text-white mb-2">
                        {team.teamName}
                      </h3>
                      <div className="text-sm text-gray-300">
                        <p>Members: {team.members?.length || 0}</p>
                        <p>Game: {team.gameId || 'Not assigned'}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'applications' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Applications Management</h2>
              <div className="grid gap-4">
                {applications.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No pending applications.</p>
                  </div>
                ) : (
                  applications.map((application) => (
                    <div key={application.applicationId} className="bg-gray-700/50 rounded-lg p-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-xl font-semibold text-white mb-2">
                            {application.username || 'Unknown Player'}
                          </h3>
                          <div className="text-sm text-gray-300">
                            <p>Game: {application.gameId}</p>
                            <p>Status: <span className={`font-semibold ${
                              application.status === 'pending' ? 'text-yellow-400' :
                              application.status === 'accepted' ? 'text-green-400' : 'text-red-400'
                            }`}>{application.status}</span></p>
                          </div>
                        </div>
                        
                        {application.status === 'pending' && (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleApplicationAction(application.applicationId, 'accept')}
                              disabled={loading}
                              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-2 rounded flex items-center"
                            >
                              <UserCheck className="w-4 h-4 mr-1" />
                              Accept
                            </button>
                            <button
                              onClick={() => handleApplicationAction(application.applicationId, 'decline')}
                              disabled={loading}
                              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-2 rounded flex items-center"
                            >
                              <UserX className="w-4 h-4 mr-1" />
                              Decline
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
