import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ChannelType } from 'discord.js';
import Team from '../models/Team.js';
import Game from '../models/Game.js';
import axios from 'axios';

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
    .setName('roll')
    .setDescription('Roll the dice to move your team (Leaders only)'),

  async execute(interaction) {
    try {
      // Find the team this user belongs to in any active game
      const team = await Team.findOne({
        $or: [
          { 'leader.userId': interaction.user.id },
          { 'coLeader.userId': interaction.user.id }
        ]
      });

      if (!team) {
        return await interaction.editReply({ 
          content: '❌ You are not a team leader or co-leader in any active game.'
        });
      }

      // Check if team can roll
      if (!team.canRoll) {
        return await interaction.editReply({ 
          content: '🚫 Your team has already rolled this turn. Wait for the next round!'
        });
      }

      // Get the game details
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

      // Check if game has officially started (teams can roll)
      if (!game.isOfficiallyStarted) {
        return await interaction.editReply({ 
          content: `⏳ Game "${game.name}" is active but has not officially started yet. Please wait for a moderator to officially start the game before rolling.`
        });
      }

      // Check if game is paused
      if (game.isPaused) {
        return await interaction.editReply({ 
          content: `⏸️ Game "${game.name}" is currently paused. Rolling is disabled until the game is resumed.`
        });
      }

      // Check if game has already been won
      if (game.winnerTeamId) {
        const winnerTeam = await Team.findOne({ teamId: game.winnerTeamId });
        return await interaction.editReply({ 
          content: `🏆 Game "${game.name}" has already been won by **${winnerTeam?.teamName || 'Unknown Team'}**! No more rolling allowed.`
        });
      }

      // Roll the dice (1-6)
      const diceRoll = Math.floor(Math.random() * 6) + 1;
      const oldPosition = team.currentPosition;
      // If roll would go over 100, land on tile 100 instead
      let newPosition = oldPosition + diceRoll;
      if (newPosition > 100) {
        newPosition = 100;
      }
      
      // Check for snakes and ladders
      let snakeOrLadderMessage = '';
      let snakeOrLadderEmoji = '';
      
      // Convert Map to object for easier access
      const snakes = Object.fromEntries(game.snakes);
      const ladders = Object.fromEntries(game.ladders);
      
      if (snakes[newPosition]) {
        const snakeEnd = snakes[newPosition];
        snakeOrLadderMessage = `🐍 **Snake Alert!** Your team landed on a snake at tile ${newPosition} and slid down to tile ${snakeEnd}!`;
        snakeOrLadderEmoji = '🐍';
        newPosition = snakeEnd;
      } else if (ladders[newPosition]) {
        const ladderEnd = ladders[newPosition];
        snakeOrLadderMessage = `🪜 **Ladder Boost!** Your team found a ladder at tile ${newPosition} and climbed up to tile ${ladderEnd}!`;
        snakeOrLadderEmoji = '🪜';
        newPosition = ladderEnd;
      }

      // Update team position and lock rolling
      team.currentPosition = newPosition;
      team.canRoll = false;

      // If this is a dashboard team without a proper channel, create one
      if (team.channelId === 'dashboard-team') {
        try {
          // Create a proper team channel
          const channel = await createTeamChannel(interaction.guild, team);
          if (channel) {
            team.channelId = channel.id;
            console.log(`Created channel ${channel.id} for dashboard team ${team.teamName}`);
          }
        } catch (error) {
          console.log('Could not create channel for dashboard team:', error);
        }
      }

      await team.save();

      // Get current tile task
      const tileTasks = Object.fromEntries(game.tileTasks);
      const currentTask = tileTasks[newPosition];

      // Create result embed
      const embed = new EmbedBuilder()
        .setTitle(`🎲 ${team.teamName} Rolled!`)
        .setDescription(`**${interaction.user.displayName}** rolled for ${team.teamName}`)
        .addFields(
          { name: '🎲 Dice Roll', value: diceRoll.toString(), inline: true },
          { name: '📍 Previous Position', value: `Tile ${oldPosition}`, inline: true },
          { name: '📍 New Position', value: `Tile ${newPosition}`, inline: true }
        )
        .setColor(newPosition === 100 ? '#FFD700' : snakeOrLadderEmoji === '🐍' ? '#FF4444' : snakeOrLadderEmoji === '🪜' ? '#44FF44' : '#0099FF');

      // Add snake/ladder message if applicable
      if (snakeOrLadderMessage) {
        embed.addFields({ name: snakeOrLadderEmoji + ' Special Move!', value: snakeOrLadderMessage });
      }

      // Add current tile task if exists
      if (currentTask) {
        let taskField = `**Task:** ${currentTask.description}`;
        
        // Add image reference if available (but don't embed base64 images)
        if (currentTask.imageUrl || currentTask.uploadedImageUrl) {
          const imageUrl = currentTask.uploadedImageUrl || currentTask.imageUrl;
          
          // Only set image for HTTP/HTTPS URLs, not base64 data URLs
          if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            embed.setImage(imageUrl);
            taskField += '\n*See image above for visual reference*';
          } else if (imageUrl.startsWith('data:')) {
            taskField += '\n*🖼️ This tile has a custom image (visible on dashboard)*';
          } else {
            taskField += '\n*🖼️ This tile has an image*';
          }
        }
        
        embed.addFields({ name: `📝 Tile ${newPosition} Task`, value: taskField });
      } else {
        embed.addFields({ name: `📝 Tile ${newPosition}`, value: 'No special task on this tile. Safe spot!' });
      }

      // Check if team reached tile 100 (but needs verification to win)
      if (newPosition === 100) {
        embed.addFields({ 
          name: '🎯 TILE 100 REACHED!', 
          value: `**${team.teamName}** has reached tile 100! You must now get verified by a moderator to win the game. 🎉\n\n**To win:** Wait for a moderator to use \`/verify\` in your team channel OR complete the task and use \`/snlsubmit\` for approval!` 
        });
        embed.setColor('#FFD700');
      } else {
        embed.addFields({ 
          name: '🔒 Task Pending', 
          value: 'Your team is now locked from rolling until you complete the task on this tile. Please finish the task and tag a moderator to unlock your next roll!' 
        });
      }

      embed.setFooter({ text: `Game: ${game.name}` })
           .setTimestamp();

      // Fetch game board image from API
      let boardAttachment = null;
      try {
        const API_URL = process.env.API_URL || 'http://localhost:5000';
        const response = await axios.get(`${API_URL}/api/games/${game.gameId}/board`, {
          responseType: 'arraybuffer',
          timeout: 10000 // 10 second timeout
        });
        
        if (response.status === 200) {
          const imageBuffer = Buffer.from(response.data);
          boardAttachment = new AttachmentBuilder(imageBuffer, { name: 'gameboard.png' });
          embed.setThumbnail('attachment://gameboard.png');
        }
      } catch (error) {
        console.error('Failed to fetch game board image:', error.message);
        // Continue without the image - don't fail the entire command
      }

      const replyOptions = { embeds: [embed] };
      if (boardAttachment) {
        replyOptions.files = [boardAttachment];
      }

      await interaction.editReply(replyOptions);

      // Send announcement to SNL announcements channel and team channel only
      try {
        // Send to SNL announcements channel
        if (game.announcementChannelId) {
          try {
            const announcementsChannel = await interaction.guild.channels.fetch(game.announcementChannelId);
            if (announcementsChannel) {
              const announcementEmbed = new EmbedBuilder()
                .setTitle(`🎲 ${team.teamName} Rolled!`)
                .setDescription(`**${interaction.user.displayName}** rolled **${diceRoll}** and moved from tile **${oldPosition}** to tile **${newPosition}**`)
                .setColor(embed.data.color);

              // Add snake/ladder message if applicable
              if (snakeOrLadderMessage) {
                announcementEmbed.addFields({ name: snakeOrLadderEmoji + ' Special Move!', value: snakeOrLadderMessage });
              }

              // Add tile 100 reached notification
              if (newPosition === 100) {
                announcementEmbed.addFields({ 
                  name: '🎯 TILE 100 REACHED!', 
                  value: `**${team.teamName}** has reached the final tile! They must now get verified by a moderator to win the game! 🎉` 
                });
              }

              // Add current tile task if exists
              if (currentTask) {
                let taskField = `**Task:** ${currentTask.description}`;
                announcementEmbed.addFields({ name: `📝 Tile ${newPosition} Task`, value: taskField });
              }

              announcementEmbed.setFooter({ text: `Game: ${game.name}` }).setTimestamp();
              
              if (boardAttachment) {
                announcementEmbed.setImage('attachment://gameboard.png');
              }
              
              const announcementOptions = { embeds: [announcementEmbed] };
              if (boardAttachment) {
                announcementOptions.files = [boardAttachment];
              }
              
              await announcementsChannel.send(announcementOptions);
            }
          } catch (error) {
            console.log('Could not post to announcements channel:', error);
          }
        }
        
        // Send to the rolling team's channel (if different from where command was used)
        if (interaction.channelId !== team.channelId && 
            team.channelId !== 'dashboard-team' && 
            team.channelId) {
          try {
            const teamChannel = await interaction.guild.channels.fetch(team.channelId);
            if (teamChannel) {
              await teamChannel.send(replyOptions);
            }
          } catch (error) {
            console.log('Could not post to team channel:', error);
          }
        }
      } catch (error) {
        console.log('Error broadcasting roll result:', error);
      }

    } catch (error) {
      console.error('Error executing roll command:', error);
      await interaction.editReply({ 
        content: '❌ Failed to roll dice. Please try again later.'
      });
    }
  },
};
