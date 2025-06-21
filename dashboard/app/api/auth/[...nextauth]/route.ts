import NextAuth from 'next-auth'
import DiscordProvider from 'next-auth/providers/discord'
import { MongoDBAdapter } from '@next-auth/mongodb-adapter'
import { MongoClient } from 'mongodb'

const client = new MongoClient(process.env.MONGO_URI!)
const clientPromise = client.connect()

/**
 * Takes a token, and returns a new token with updated
 * `accessToken` and `accessTokenExpires`. If an error occurs,
 * returns the old token and an error property
 */
async function refreshAccessToken(token: any) {
  try {
    const url = "https://discord.com/api/oauth2/token"
    
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    })

    const refreshedTokens = await response.json()

    if (!response.ok) {
      throw refreshedTokens
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      expiresAt: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Fall back to old refresh token
    }
  } catch (error) {
    console.log(error)

    return {
      ...token,
      error: "RefreshAccessTokenError",
    }
  }
}

export const authOptions = {
  // Remove MongoDB adapter when using JWT strategy
  // adapter: MongoDBAdapter(clientPromise),
  secret: process.env.NEXTAUTH_SECRET,
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
              console.log('Discord guilds:', guilds.map((g: any) => ({ id: g.id, name: g.name, permissions: g.permissions })))
              console.log('Target guild ID:', process.env.GUILD_ID)
              
              const targetGuild = guilds.find((guild: any) => guild.id === process.env.GUILD_ID)
              console.log('Target guild found:', targetGuild)
              
              if (targetGuild) {
                session.user.guildMember = true
                session.user.guildPermissions = targetGuild.permissions
                
                // Check if user is admin in the guild (Administrator permission = 0x8)
                const permissions = BigInt(targetGuild.permissions)
                const isAdmin = (permissions & BigInt(0x8)) === BigInt(0x8)
                session.user.isAdmin = isAdmin
                
                console.log('Permission check:', {
                  userId: session.user.id,
                  permissions: targetGuild.permissions,
                  permissionsBigInt: permissions.toString(),
                  isAdmin,
                  hasAdminFlag: (permissions & BigInt(0x8)) === BigInt(0x8)
                })
                
                // Temporary override for testing - replace with your Discord user ID
                const testAdminIds = ['YOUR_DISCORD_USER_ID', '123456789012345678'] // Add your Discord ID here
                if (testAdminIds.includes(session.user.id)) {
                  console.log('Override: Setting user as admin for testing')
                  session.user.isAdmin = true
                }
                
                // Fetch moderator role from GameParameters via API
                try {
                  const apiResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/guild/${process.env.GUILD_ID}/moderator-role`)
                  if (apiResponse.ok) {
                    const { moderatorRoleId } = await apiResponse.json()
                    
                    // Check if user has moderator role by fetching guild member info
                    if (moderatorRoleId) {
                      const memberResponse = await fetch(`https://discord.com/api/guilds/${process.env.GUILD_ID}/members/${session.user.id}`, {
                        headers: {
                          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                        },
                      })
                      
                      if (memberResponse.ok) {
                        const member = await memberResponse.json()
                        session.user.isModerator = member.roles.includes(moderatorRoleId)
                        console.log('Moderator role check:', {
                          moderatorRoleId,
                          userRoles: member.roles,
                          isModerator: session.user.isModerator
                        })
                      }
                    }
                  }
                } catch (error) {
                  console.warn('Failed to check moderator role:', error)
                  session.user.isModerator = false
                }
              } else {
                // User not in target guild
                session.user.guildMember = false
                session.user.isAdmin = false
                session.user.isModerator = false
              }
            } else {
              console.error('Discord API response not ok:', discordResponse.status)
              session.user.guildMember = false
              session.user.isAdmin = false
              session.user.isModerator = false
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
    async jwt({ token, account, profile }: any) {
      // Persist the OAuth access_token and refresh_token to the token right after signin
      if (account) {
        console.log('Account data received:', { 
          provider: account.provider, 
          type: account.type,
          hasAccessToken: !!account.access_token 
        })
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at
        
        // Store user profile information
        if (profile) {
          token.id = profile.id
          token.username = profile.username
          token.discriminator = profile.discriminator
          token.avatar = profile.avatar
        }
      }
      
      // Return previous token if the access token has not expired yet
      if (token.expiresAt && Date.now() < token.expiresAt * 1000) {
        return token
      }
      
      // Access token has expired, try to update it
      if (token.refreshToken) {
        return await refreshAccessToken(token)
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
