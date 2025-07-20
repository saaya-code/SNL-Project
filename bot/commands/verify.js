import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import Team from '../models/Team.js';
import Game from '../models/Game.js';

// Helper function to check if team wins when verified at tile 100
async function checkWinCondition(team, interaction) {
  if (team.currentPosition === 100) {
    // Team wins! Update game status and lock all other teams
    const game = await Game.findOne({ gameId: team.gameId });
    
    if (game && !game.winnerTeamId) {
      // Set winner and complete the game
      game.winnerTeamId = team.teamId;
      game.completedAt = new Date();
      game.status = 'completed';
      await game.save();
      
      // Lock all other teams from rolling
      await Team.updateMany(
        { 
          gameId: team.gameId,
          teamId: { $ne: team.teamId } // All teams except the winner
        },
        { canRoll: false }
      );
      
      return {
        isWin: true,
        message: `🏆 **${team.teamName}** has WON the game! 🎉\n\nCongratulations on completing Snakes & Ladders! All other teams are now locked from rolling.`
      };
    } else if (game?.winnerTeamId) {
      return {
        isWin: false,
        message: `❌ Game has already been won by another team. No further verification needed.`
      };
    }
  }
  
  return {
    isWin: false,
    message: `✅ **${team.teamName}** can now roll again! Notified the team.`
  };
}

// Helper function to create a proper team channel
async function createTeamChannel(guild, team) {
  try {
    // Find or create "Team Rooms" category
    let category = guild.channels.cache.find(
      channel => channel.type === ChannelType.GuildCategory && 
                 channel.name.toLowerCase() === 'team rooms'
    );
    
    if (!category) {
      category = await guild.channels.create({
        name: 'Team Rooms',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
            deny: ['ViewChannel'],
          }
        ]
      });
    }
    
    // Create channel name from team name (sanitized)
    const channelName = team.teamName.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .substring(0, 100); // Discord channel name limit
    
    // Create the channel under the Team Rooms category
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: `Team channel for ${team.teamName} - Snakes & Ladders Game`,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: ['ViewChannel'],
        }
      ]
    });

    // Get all team members' Discord IDs
    const memberIds = [];
    
    // Add leader
    if (team.leader && team.leader.userId) {
      memberIds.push(team.leader.userId);
    }
    
    // Add co-leader if exists and different from leader
    if (team.coLeader && team.coLeader.userId && team.coLeader.userId !== team.leader.userId) {
      memberIds.push(team.coLeader.userId);
    }
    
    // Add other members
    if (team.members && Array.isArray(team.members)) {
      team.members.forEach(member => {
        if (member.userId && !memberIds.includes(member.userId)) {
          memberIds.push(member.userId);
        }
      });
    }

    // Add permissions for team members
    for (const userId of memberIds) {
      try {
        await channel.permissionOverwrites.create(userId, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          UseApplicationCommands: true
        });
      } catch (err) {
        console.error(`Failed to add permissions for user ${userId}:`, err);
      }
    }

    // Send welcome message
    const memberMentions = memberIds.map(id => `<@${id}>`).join(', ');
    await channel.send({
      content: `🎉 Welcome to your team channel, **${team.teamName}**!\n\n` +
               `Team Members: ${memberMentions}\n\n` +
               `🎲 Use \`/roll\` to roll the dice when it's your turn!\n` +
               `📍 Current Position: **Tile ${team.currentPosition}**\n\n` +
               `Good luck in the Snakes & Ladders game! 🐍🪜`
    });

    return channel;
  } catch (error) {
    console.error('Error creating team channel:', error);
    throw error;
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Verify a team\'s task completion and allow them to roll again (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.editReply({
        content: '❌ You need Administrator permissions to verify tasks.'
      });
    }
    try {
      // Check if this channel belongs to a team
      const team = await Team.findOne({ channelId: interaction.channelId });
      if (team) {
        // Get the game details to check status
        const game = await Game.findOne({ gameId: team.gameId });
        if (!game) {
          return await interaction.editReply({
            content: '❌ Game not found.'
          });
        }

        // Check if game is active
        if (game.status !== 'active') {
          return await interaction.editReply({
            content: `❌ Game "${game.name}" is not currently active. Status: ${game.status}`
          });
        }

        // Check if game has officially started (teams can take actions)
        if (!game.isOfficiallyStarted) {
          return await interaction.editReply({
            content: `⏳ Game "${game.name}" is active but has not officially started yet. Teams cannot be verified until the game officially starts.`
          });
        }

        // Check if game is paused
        if (game.isPaused) {
          return await interaction.editReply({
            content: `⏸️ Game "${game.name}" is currently paused. Team verification is disabled until the game is resumed.`
          });
        }

        // Check if game has already been won
        if (game.winnerTeamId) {
          const winnerTeam = await Team.findOne({ teamId: game.winnerTeamId });
          return await interaction.editReply({
            content: `🏆 Game "${game.name}" has already been won by **${winnerTeam?.teamName || 'Unknown Team'}**! No further verification needed.`
          });
        }

        // Allow the team to roll again
        team.canRoll = true;
        await team.save();
        
        // Check if team wins by being verified at tile 100
        const winResult = await checkWinCondition(team, interaction);
        
        await interaction.editReply({
          content: winResult.message
        });
        
        // Notify the team channel if not already in it
        if (interaction.channelId !== team.channelId) {
          try {
            const teamChannel = await interaction.guild.channels.fetch(team.channelId);
            if (teamChannel) {
              const notificationMessage = winResult.isWin 
                ? `🏆 **VICTORY!** Your team has WON the game! 🎉\n\nCongratulations on completing Snakes & Ladders!`
                : `🎉 Your task has been verified by an admin! You can now roll the dice again. Use "/roll" to continue.`;
                
              await teamChannel.send({
                content: notificationMessage
              });
            }
          } catch (err) { /* ignore */ }
        }

        // If team won, broadcast to announcement channel
        if (winResult.isWin) {
          try {
            const game = await Game.findOne({ gameId: team.gameId });
            if (game?.announcementChannelId) {
              const announcementChannel = await interaction.guild.channels.fetch(game.announcementChannelId);
              if (announcementChannel) {
                await announcementChannel.send({
                  content: `🏆 **GAME OVER!** 🏆\n\n**${team.teamName}** has won **${game.name}**!\n\n🎉 Congratulations to all participants! 🎉`
                });
              }
            }
          } catch (err) {
            console.log('Could not broadcast win to announcement channel:', err);
          }
        }
      } else {
        // Not in a team channel, show modal for manual selection
        // For now, we'll implement a simple approach without the modal
        const teams = await Team.find({ canRoll: false });
        
        if (teams.length === 0) {
          return await interaction.editReply({
            content: '✅ All teams are currently able to roll. No verification needed!'
          });
        }

        // Show list of teams that need verification
        const teamList = [];
        
        for (let i = 0; i < teams.length; i++) {
          const team = teams[i];
          let channelDisplay;
          
          // Check if team has a placeholder channel ID
          if (team.channelId === 'dashboard-team' || team.channelId === 'dashboard-created') {
            channelDisplay = '🔧 *No channel created yet*';
          } else {
            channelDisplay = `Channel: <#${team.channelId}>`;
          }
          
          teamList.push(`${i + 1}. **${team.teamName}** - Tile ${team.currentPosition} (${channelDisplay})`);
        }

        await interaction.editReply({
          content: `🎲 **Teams waiting for verification:**\n\n${teamList.join('\n')}\n\n💡 **Tip:** Use this command directly in a team's channel for quick verification!\n🔧 **For teams without channels:** Reply with the team number to create their channel and verify them!`
        });
        
        // Set up a message collector to handle team selection
        const filter = (message) => {
          return message.author.id === interaction.user.id && 
                 !isNaN(message.content) && 
                 parseInt(message.content) >= 1 && 
                 parseInt(message.content) <= teams.length;
        };
        
        const collector = interaction.channel.createMessageCollector({ 
          filter, 
          time: 60000, // 1 minute
          max: 1 
        });
        
        collector.on('collect', async (message) => {
          const teamIndex = parseInt(message.content) - 1;
          const selectedTeam = teams[teamIndex];
          
          try {
            await message.react('⏳');
            
            // Check if team needs a channel created
            if (selectedTeam.channelId === 'dashboard-team' || selectedTeam.channelId === 'dashboard-created') {
              await message.react('🔧');
              
              // Create the team channel
              const newChannel = await createTeamChannel(interaction.guild, selectedTeam);
              
              // Update team in database with new channel ID
              selectedTeam.channelId = newChannel.id;
              selectedTeam.canRoll = true;
              await selectedTeam.save();
              
              // Check if team wins by being verified at tile 100
              const winResult = await checkWinCondition(selectedTeam, interaction);
              
              await message.react('✅');
              await message.reply({
                content: `${winResult.message}\n` +
                        `🏠 Created team channel: ${newChannel}\n` +
                        `🎲 They can now roll the dice!`
              });
            } else {
              // Just verify the team
              selectedTeam.canRoll = true;
              await selectedTeam.save();
              
              // Check if team wins by being verified at tile 100
              const winResult = await checkWinCondition(selectedTeam, interaction);
              
              await message.react('✅');
              await message.reply({
                content: winResult.message
              });
              
              // Notify the team channel
              try {
                const teamChannel = await interaction.guild.channels.fetch(selectedTeam.channelId);
                if (teamChannel) {
                  const notificationMessage = winResult.isWin 
                    ? `🏆 **VICTORY!** Your team has WON the game! 🎉`
                    : `🎉 Your task has been verified by an admin! You can now roll the dice again. Use "/roll" to continue.`;
                    
                  await teamChannel.send({
                    content: notificationMessage
                  });
                }
              } catch (err) {
                console.error('Failed to notify team channel:', err);
              }
            }
          } catch (error) {
            console.error('Error verifying team:', error);
            await message.react('❌');
            await message.reply({
              content: '❌ Failed to verify team. Please try again.'
            });
          }
        });
        
        collector.on('end', (collected) => {
          if (collected.size === 0) {
            interaction.followUp({
              content: '⏰ Team selection timed out. Use the `/verify` command again to try again.',
              ephemeral: true
            });
          }
        });
      }
    } catch (error) {
      console.error('Error in verify command:', error);
      await interaction.editReply({
        content: '❌ Failed to process verification. Please try again later.'
      });
    }
  },
};
