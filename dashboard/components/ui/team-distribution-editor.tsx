'use client'

import { useState } from 'react'
import { Team, TeamMember } from '@/types/index'
import { Users, Crown, Shield, Trash2, UserPlus } from 'lucide-react'

interface TeamDistributionEditorProps {
  teams: Team[]
  onChange: (teams: Team[]) => void
}

interface DraggedMember {
  member: TeamMember
  sourceTeamId: string
  isLeader: boolean
  isCoLeader: boolean
}

export default function TeamDistributionEditor({ teams, onChange }: TeamDistributionEditorProps) {
  const [draggedMember, setDraggedMember] = useState<DraggedMember | null>(null)
  const [dragOverTeam, setDragOverTeam] = useState<string | null>(null)

  const handleDragStart = (member: TeamMember, teamId: string) => {
    const team = teams.find(t => t.teamId === teamId)
    if (!team) return

    setDraggedMember({
      member,
      sourceTeamId: teamId,
      isLeader: team.leader.userId === member.userId,
      isCoLeader: team.coLeader?.userId === member.userId
    })
  }

  const handleDragOver = (e: React.DragEvent, teamId: string) => {
    e.preventDefault()
    setDragOverTeam(teamId)
  }

  const handleDragLeave = () => {
    setDragOverTeam(null)
  }

  const handleDrop = (e: React.DragEvent, targetTeamId: string) => {
    e.preventDefault()
    setDragOverTeam(null)

    if (!draggedMember || draggedMember.sourceTeamId === targetTeamId) {
      setDraggedMember(null)
      return
    }

    const updatedTeams = teams.map(team => {
      // Remove member from source team
      if (team.teamId === draggedMember.sourceTeamId) {
        const newMembers = team.members.filter(m => m.userId !== draggedMember.member.userId)
        const newTeam = { ...team, members: newMembers }

        // Handle leadership changes when removing
        if (draggedMember.isLeader && newMembers.length > 0) {
          // Promote co-leader to leader, or first member if no co-leader
          const newLeader = team.coLeader && newMembers.find(m => m.userId === team.coLeader?.userId) 
            ? team.coLeader 
            : newMembers[0]
          newTeam.leader = newLeader
          newTeam.coLeader = team.coLeader?.userId === newLeader.userId ? null : team.coLeader
        } else if (draggedMember.isCoLeader) {
          newTeam.coLeader = null
        }

        return newTeam
      }

      // Add member to target team
      if (team.teamId === targetTeamId) {
        const newMembers = [...team.members, draggedMember.member]
        return {
          ...team,
          members: newMembers
        }
      }

      return team
    })

    onChange(updatedTeams)
    setDraggedMember(null)
  }

  const promoteToLeader = (teamId: string, member: TeamMember) => {
    const updatedTeams = teams.map(team => {
      if (team.teamId === teamId) {
        const oldLeader = team.leader
        return {
          ...team,
          leader: member,
          coLeader: team.coLeader?.userId === member.userId ? oldLeader : team.coLeader
        }
      }
      return team
    })
    onChange(updatedTeams)
  }

  const promoteToCoLeader = (teamId: string, member: TeamMember) => {
    const updatedTeams = teams.map(team => {
      if (team.teamId === teamId) {
        return {
          ...team,
          coLeader: member
        }
      }
      return team
    })
    onChange(updatedTeams)
  }

  const removeCoLeader = (teamId: string) => {
    const updatedTeams = teams.map(team => {
      if (team.teamId === teamId) {
        return {
          ...team,
          coLeader: null
        }
      }
      return team
    })
    onChange(updatedTeams)
  }

  const removeMember = (teamId: string, member: TeamMember) => {
    const team = teams.find(t => t.teamId === teamId)
    if (!team || team.members.length <= 1) return // Don't allow removing the last member

    const isLeader = team.leader.userId === member.userId
    const isCoLeader = team.coLeader?.userId === member.userId

    const updatedTeams = teams.map(t => {
      if (t.teamId === teamId) {
        const newMembers = t.members.filter(m => m.userId !== member.userId)
        const newTeam = { ...t, members: newMembers }

        // Handle leadership changes
        if (isLeader && newMembers.length > 0) {
          const newLeader = t.coLeader && newMembers.find(m => m.userId === t.coLeader?.userId) 
            ? t.coLeader 
            : newMembers[0]
          newTeam.leader = newLeader
          newTeam.coLeader = t.coLeader?.userId === newLeader.userId ? null : t.coLeader
        } else if (isCoLeader) {
          newTeam.coLeader = null
        }

        return newTeam
      }
      return t
    })

    onChange(updatedTeams)
  }

  const getTeamStats = () => {
    const totalMembers = teams.reduce((sum, team) => sum + team.members.length, 0)
    const minTeamSize = Math.min(...teams.map(team => team.members.length))
    const maxTeamSize = Math.max(...teams.map(team => team.members.length))
    
    return { totalMembers, minTeamSize, maxTeamSize, isBalanced: maxTeamSize - minTeamSize <= 1 }
  }

  const stats = getTeamStats()

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="bg-gray-700/50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-white font-medium">
              {teams.length} Teams • {stats.totalMembers} Total Members
            </span>
            <span className={`text-sm px-2 py-1 rounded ${
              stats.isBalanced ? 'bg-green-600/20 text-green-400' : 'bg-yellow-600/20 text-yellow-400'
            }`}>
              {stats.isBalanced ? 'Balanced' : 'Unbalanced'} 
              ({stats.minTeamSize}-{stats.maxTeamSize} members per team)
            </span>
          </div>
        </div>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team) => (
          <div
            key={team.teamId}
            className={`bg-gray-700/50 rounded-lg p-4 border-2 transition-colors ${
              dragOverTeam === team.teamId 
                ? 'border-blue-400 bg-blue-400/10' 
                : 'border-gray-600'
            }`}
            onDragOver={(e) => handleDragOver(e, team.teamId)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, team.teamId)}
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                {team.teamName}
              </h4>
              <span className="text-sm text-gray-400">
                {team.members.length} member{team.members.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-2">
              {team.members.map((member) => {
                const isLeader = team.leader.userId === member.userId
                const isCoLeader = team.coLeader?.userId === member.userId
                const canBeRemoved = team.members.length > 1

                return (
                  <div
                    key={member.userId}
                    className="bg-gray-600/50 rounded p-3 cursor-move group hover:bg-gray-600/70 transition-colors"
                    draggable
                    onDragStart={() => handleDragStart(member, team.teamId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <span className="text-white font-medium">
                            {member.displayName}
                          </span>
                          <span className="text-xs text-gray-400">
                            @{member.username}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {isLeader && (
                            <div title="Team Leader">
                              <Crown className="w-4 h-4 text-yellow-400" />
                            </div>
                          )}
                          {isCoLeader && (
                            <div title="Co-Leader">
                              <Shield className="w-4 h-4 text-blue-400" />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        {/* Leadership Controls */}
                        {!isLeader && (
                          <button
                            onClick={() => promoteToLeader(team.teamId, member)}
                            className="p-1 text-yellow-400 hover:bg-yellow-400/20 rounded"
                            title="Make Leader"
                          >
                            <Crown className="w-3 h-3" />
                          </button>
                        )}
                        {!isLeader && !isCoLeader && (
                          <button
                            onClick={() => promoteToCoLeader(team.teamId, member)}
                            className="p-1 text-blue-400 hover:bg-blue-400/20 rounded"
                            title="Make Co-Leader"
                          >
                            <Shield className="w-3 h-3" />
                          </button>
                        )}
                        {isCoLeader && (
                          <button
                            onClick={() => removeCoLeader(team.teamId)}
                            className="p-1 text-gray-400 hover:bg-gray-400/20 rounded"
                            title="Remove Co-Leader Role"
                          >
                            <Shield className="w-3 h-3" />
                          </button>
                        )}
                        
                        {/* Remove Member */}
                        {canBeRemoved && (
                          <button
                            onClick={() => removeMember(team.teamId, member)}
                            className="p-1 text-red-400 hover:bg-red-400/20 rounded"
                            title="Remove from Team"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {team.members.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Drop members here</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Drag Instructions */}
      <div className="bg-blue-600/10 border border-blue-600/30 rounded-lg p-4">
        <h5 className="text-blue-400 font-medium mb-2">How to edit teams:</h5>
        <ul className="text-sm text-blue-300 space-y-1">
          <li>• Drag and drop members between teams</li>
          <li>• Click the crown icon to make someone a team leader</li>
          <li>• Click the shield icon to make someone a co-leader</li>
          <li>• Click the trash icon to remove a member (if team has more than 1 member)</li>
        </ul>
      </div>
    </div>
  )
}
