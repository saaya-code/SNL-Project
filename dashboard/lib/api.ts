import axios from 'axios'
import { Game, Team, Application, GameParameters, DashboardStats } from '@/types/index'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

// Games API
export const gamesApi = {
  async getAll(): Promise<Game[]> {
    const response = await api.get('/api/games')
    return response.data
  },

  async getById(gameId: string): Promise<Game> {
    const response = await api.get(`/api/games/${gameId}`)
    return response.data
  },

  async create(gameData: Partial<Game>): Promise<Game> {
    const response = await api.post('/api/games', gameData)
    return response.data
  },

  async update(gameId: string, gameData: Partial<Game>): Promise<Game> {
    const response = await api.put(`/api/games/${gameId}`, gameData)
    return response.data
  },

  async delete(gameId: string): Promise<void> {
    await api.delete(`/api/games/${gameId}`)
  },

  async getBoardImage(gameId: string): Promise<Blob> {
    const response = await api.get(`/api/games/${gameId}/board`, {
      responseType: 'blob'
    })
    return response.data
  },

  async startRegistration(gameId: string, maxTeamSize: number): Promise<Game> {
    const response = await api.post(`/api/games/${gameId}/start-registration`, {
      maxTeamSize
    })
    return response.data
  },

  async startGame(gameId: string): Promise<Game> {
    const response = await api.post(`/api/games/${gameId}/start`)
    return response.data
  },

  async distributeTeams(gameId: string): Promise<{ teams: Team[], acceptedApplications: number, devMode: boolean }> {
    const response = await api.post(`/api/games/${gameId}/distribute-teams`)
    return response.data
  },

  async startGameWithTeams(gameId: string, teams: Team[]): Promise<Game> {
    const response = await api.post(`/api/games/${gameId}/start-with-teams`, { teams })
    return response.data
  },

  async resetGame(gameId: string, resetType: string): Promise<Game> {
    const response = await api.post(`/api/games/${gameId}/reset`, {
      resetType
    })
    return response.data
  },

  async updateAnnouncementChannel(gameId: string, announcementChannelId?: string, announcementWebhookUrl?: string): Promise<Game> {
    const response = await api.put(`/api/games/${gameId}/announcement-channel`, {
      announcementChannelId,
      announcementWebhookUrl
    })
    return response.data
  },

  async getTile(gameId: string, tileNumber: number): Promise<any> {
    const response = await api.get(`/api/games/${gameId}/tiles/${tileNumber}`)
    return response.data
  },

  async updateTile(gameId: string, tileNumber: number, tileData: any): Promise<any> {
    const response = await api.put(`/api/games/${gameId}/tiles/${tileNumber}`, tileData)
    return response.data
  },

  async updateTileSnakeLadder(gameId: string, tileNumber: number, snakeLadderData: any): Promise<any> {
    const response = await api.put(`/api/games/${gameId}/tiles/${tileNumber}/snake-ladder`, snakeLadderData)
    return response.data
  }
}

// Teams API
export const teamsApi = {
  async getByGame(gameId: string): Promise<Team[]> {
    const response = await api.get(`/api/games/${gameId}/teams`)
    return response.data
  },

  async getAll(): Promise<Team[]> {
    const response = await api.get('/api/teams')
    return response.data
  },

  async getById(teamId: string): Promise<Team> {
    const response = await api.get(`/api/teams/${teamId}`)
    return response.data
  },

  async roll(teamId: string, userId: string): Promise<{
    diceRoll: number
    oldPosition: number
    newPosition: number
    snakeOrLadder?: string
  }> {
    const response = await api.post(`/api/teams/${teamId}/roll`, { userId })
    return response.data
  },

  async getAllByUser(userId: string): Promise<Team[]> {
    const response = await api.get(`/api/users/${userId}/teams`)
    return response.data
  },

  async setVerification(teamId: string, canRoll: boolean): Promise<Team> {
    const response = await api.post(`/api/teams/${teamId}/verify`, { canRoll })
    return response.data
  },

  async updateMembers(teamId: string, members: any[], leader?: any, coLeader?: any): Promise<Team> {
    const response = await api.put(`/api/teams/${teamId}/members`, { members, leader, coLeader })
    return response.data
  },

  async exchangeMembers(sourceTeamId: string, targetTeamId: string, memberToMove: any): Promise<{
    sourceTeam: Team
    targetTeam: Team
  }> {
    const response = await api.put('/api/teams/exchange', {
      sourceTeamId,
      targetTeamId,
      memberToMove
    })
    return response.data
  },
}

// Applications API
export const applicationsApi = {
  async getByGame(gameId: string): Promise<Application[]> {
    const response = await api.get(`/api/games/${gameId}/applications`)
    return response.data
  },

  async getAll(): Promise<Application[]> {
    const response = await api.get('/api/applications')
    return response.data
  },

  async create(applicationData: Partial<Application>): Promise<Application> {
    const response = await api.post('/api/applications', applicationData)
    return response.data
  },

  async accept(applicationId: string, reviewerId: string, notes?: string): Promise<Application> {
    console.log('API: Accepting application:', { applicationId, reviewerId, notes })
    const response = await api.post(`/api/applications/${applicationId}/accept`, {
      reviewerId,
      notes
    })
    return response.data
  },

  async reject(applicationId: string, reviewerId: string, notes?: string): Promise<Application> {
    console.log('API: Rejecting application:', { applicationId, reviewerId, notes })
    const response = await api.post(`/api/applications/${applicationId}/reject`, {
      reviewerId,
      notes
    })
    return response.data
  },

  async getByUser(userId: string): Promise<Application[]> {
    const response = await api.get(`/api/users/${userId}/applications`)
    return response.data
  }
}

// Game Parameters API
export const gameParametersApi = {
  async get(guildId: string): Promise<GameParameters> {
    const response = await api.get(`/api/guilds/${guildId}/parameters`)
    return response.data
  },

  async update(guildId: string, params: Partial<GameParameters>): Promise<GameParameters> {
    const response = await api.put(`/api/guilds/${guildId}/parameters`, params)
    return response.data
  },

  async setModeratorRole(guildId: string, roleId: string | null): Promise<GameParameters> {
    const response = await api.post(`/api/guilds/${guildId}/moderator-role`, {
      moderatorRoleId: roleId
    })
    return response.data
  }
}

// Dashboard API
export const dashboardApi = {
  async getStats(): Promise<DashboardStats> {
    const response = await api.get('/api/dashboard/stats')
    return response.data
  }
}
