'use client'

import { useState } from 'react'
import { Game, Team, Application, User } from '@/types/index'
import { 
  Users, 
  Gamepad2, 
  Plus,
  Dice6,
  Trophy,
  Clock,
  Send
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
  const [activeTab, setActiveTab] = useState<'my-games' | 'available-games' | 'applications'>('my-games')
  const [loading, setLoading] = useState(false)

  // Filter data for current user
  const myTeams = teams.filter(team => 
    team.members.some((member: any) => member.userId === user.id) ||
    team.leader.userId === user.id ||
    (team.coLeader && team.coLeader.userId === user.id)
  )
  
  const myGames = games.filter(game => 
    myTeams.some(team => team.gameId === game.gameId)
  )
  
  const availableGames = games.filter(game => 
    game.status === 'registration' && 
    !myTeams.some(team => team.gameId === game.gameId)
  )
  
  const myApplications = applications.filter(app => app.userId === user.id)

  const handleRollDice = async (teamId: string) => {
    try {
      setLoading(true)
      const result = await teamsApi.roll(teamId, user.id || '')
      
      toast.success(`Rolled ${result.diceRoll}! Moved from ${result.oldPosition} to ${result.newPosition}${result.snakeOrLadder ? ` (${result.snakeOrLadder})` : ''}`)
      
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
    'applications': { icon: Send, label: 'Applications', count: myApplications.length }
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
                    const myTeam = myTeams.find(team => team.gameId === game.gameId)
                    const position = myTeam ? getTeamPosition(myTeam) : 0
                    
                    return (
                      <div key={game.gameId} className="bg-gray-700/50 rounded-lg p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-xl font-semibold text-white mb-2">
                              {game.name}
                            </h3>
                            <div className="space-y-1 text-sm text-gray-300">
                              <p>Status: <span className={`font-semibold ${
                                game.status === 'active' ? 'text-green-400' :
                                game.status === 'registration' ? 'text-yellow-400' : 'text-gray-400'
                              }`}>{game.status}</span></p>
                              {myTeam && (
                                <>
                                  <p>Team: {myTeam.teamName}</p>
                                  <p>Position: {myTeam.currentPosition}/100</p>
                                  <p>Ranking: #{position}</p>
                                </>
                              )}
                            </div>
                          </div>
                          
                          {myTeam && game.status === 'active' && myTeam.canRoll && (
                            <button
                              onClick={() => handleRollDice(myTeam.teamId)}
                              disabled={loading}
                              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center"
                            >
                              <Dice6 className="w-4 h-4 mr-2" />
                              Roll Dice
                            </button>
                          )}
                        </div>
                        
                        {myTeam && (
                          <div className="bg-gray-600/50 rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-gray-300 mb-2">Team Members:</h4>
                            <div className="flex flex-wrap gap-2">
                              <span className="bg-yellow-600 text-white px-2 py-1 rounded text-xs">
                                👑 {myTeam.leader.displayName}
                              </span>
                              {myTeam.coLeader && (
                                <span className="bg-orange-600 text-white px-2 py-1 rounded text-xs">
                                  🥈 {myTeam.coLeader.displayName}
                                </span>
                              )}
                              {myTeam.members.map((member: any, index: number) => (
                                <span key={index} className="bg-gray-600 text-white px-2 py-1 rounded text-xs">
                                  {member.displayName}
                                </span>
                              ))}
                            </div>
                            
                            {!myTeam.canRoll && game.status === 'active' && (
                              <div className="mt-2 text-xs text-yellow-400">
                                ⏳ Waiting for next round or task completion
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
        </div>
      </div>
    </div>
  )
}
