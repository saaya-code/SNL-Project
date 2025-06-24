import NextAuth from 'next-auth'
import DiscordProvider from 'next-auth/providers/discord'
import { MongoDBAdapter } from '@next-auth/mongodb-adapter'
import { MongoClient } from 'mongodb'

const client = new MongoClient(process.env.MONGO_URI!)
const clientPromise = client.connect()

export const authOptions = {
  // Remove adapter when using JWT strategy
  // adapter: MongoDBAdapter(clientPromise),
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'identify guilds',
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, token }: any) {
      // In JWT strategy, user data comes from token, not user parameter
      if (session?.user && token) {
        session.user.id = token.sub || token.id
        
        console.log('Session callback - Token info:', {
          hasAccessToken: !!token.accessToken,
          tokenKeys: Object.keys(token),
          userId: token.sub || token.id
        })
        
        // Only try to fetch Discord data if we have an access token
        if (token.accessToken) {
          try {
            const discordResponse = await fetch('https://discord.com/api/users/@me/guilds', {
              headers: {
                Authorization: `Bearer ${token.accessToken}`,
              },
            })
            
            if (discordResponse.ok) {
              const guilds = await discordResponse.json()
              const targetGuild = guilds.find((guild: any) => guild.id === process.env.GUILD_ID)
              
              if (targetGuild) {
                session.user.guildMember = true
                session.user.guildPermissions = targetGuild.permissions
                
                // Check if user is admin in the guild
                const isAdmin = (parseInt(targetGuild.permissions) & 0x8) === 0x8
                session.user.isAdmin = isAdmin
                
                console.log('Admin check:', { 
                  permissions: targetGuild.permissions, 
                  isAdmin,
                  userId: session.user.id 
                })
                
                // Fetch moderator role from GameParameters
                // This would require API call to check moderator role
                session.user.isModerator = false // Will be set via API call
              } else {
                session.user.guildMember = false
                session.user.isAdmin = false
                session.user.isModerator = false
              }
            }
          } catch (error) {
            console.error('Failed to fetch Discord guilds:', error)
            session.user.guildMember = false
            session.user.isAdmin = false
            session.user.isModerator = false
          }
        } else {
          console.warn('No access token available for Discord API calls')
          session.user.guildMember = false
          session.user.isAdmin = false
          session.user.isModerator = false
        }
      }
      
      return session
    },
    async jwt({ token, account }: any) {
      if (account) {
        console.log('JWT callback - Account data:', {
          provider: account.provider,
          type: account.type,
          hasAccessToken: !!account.access_token,
          hasRefreshToken: !!account.refresh_token
        })
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
      }
      return token
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt' as const,
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
