export interface User {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
  guildMember?: boolean
  guildPermissions?: string
  isAdmin?: boolean
  isModerator?: boolean
}

export interface Session {
  user: User
  expires: string
}

export interface Game {
  id?: string
  gameId: string
  name: string
  status: 'pending' | 'registration' | 'active' | 'completed'
  channelId?: string
  tileTasks: Record<string, TaskData>
  snakes: Record<string, number>
  ladders: Record<string, number>
  participants: string[]
  createdBy: string
  applicationDeadline?: string
  snakeCount: number
  ladderCount: number
  maxTeamSize: number
  createdAt: string
  updatedAt: string
}

export interface TaskData {
  name: string
  description?: string
  imageUrl?: string
  uploadedImageUrl?: string
  uploadedImageName?: string
}

export interface Team {
  id?: string
  teamId: string
  gameId: string
  teamName: string
  members: TeamMember[]
  leader: TeamMember
  coLeader?: TeamMember | null
  channelId: string
  currentPosition: number
  canRoll: boolean
  createdAt: string
}

export interface TeamMember {
  userId: string
  username: string
  displayName: string
}

export interface Application {
  id?: string
  applicationId: string
  gameId: string
  userId: string
  username: string
  displayName: string
  avatarUrl?: string
  channelId: string
  status: 'pending' | 'accepted' | 'rejected'
  appliedAt: string
  reviewedAt?: string
  reviewedBy?: string
  notes?: string
  createdAt?: string
}

export interface GameParameters {
  guildId: string
  moderatorRoleId?: string
  settings: {
    allowMultipleGames: boolean
    defaultGameDuration: number
    maxTeamsPerGame: number
  }
  createdAt: string
  updatedAt: string
}

export interface DashboardStats {
  totalGames: number
  activeGames: number
  totalTeams: number
  pendingApplications: number
}

export interface GameAction {
  id: string
  label: string
  description?: string
  icon?: string
  variant?: 'primary' | 'secondary' | 'danger' | 'success'
  disabled?: boolean
  requiresConfirmation?: boolean
}
