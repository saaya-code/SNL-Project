import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import Team from '../models/Team.js';

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
        // Allow the team to roll again
        team.canRoll = true;
        await team.save();
        await interaction.editReply({
          content: `✅ **${team.teamName}** can now roll again! Notified the team.`
        });
        // Notify the team channel if not already in it
        if (interaction.channelId !== team.channelId) {
          try {
            const teamChannel = await interaction.guild.channels.fetch(team.channelId);
            if (teamChannel) {
              await teamChannel.send({
                content: `🎉 Your task has been verified by an admin! You can now roll the dice again. Use "/roll" to continue.`
              });
            }
          } catch (err) { /* ignore */ }
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
              
              await message.react('✅');
              await message.reply({
                content: `✅ **${selectedTeam.teamName}** has been verified!\n` +
                        `🏠 Created team channel: ${newChannel}\n` +
                        `🎲 They can now roll the dice!`
              });
            } else {
              // Just verify the team
              selectedTeam.canRoll = true;
              await selectedTeam.save();
              
              await message.react('✅');
              await message.reply({
                content: `✅ **${selectedTeam.teamName}** has been verified and can now roll the dice!`
              });
              
              // Notify the team channel
              try {
                const teamChannel = await interaction.guild.channels.fetch(selectedTeam.channelId);
                if (teamChannel) {
                  await teamChannel.send({
                    content: `🎉 Your task has been verified by an admin! You can now roll the dice again. Use "/roll" to continue.`
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
