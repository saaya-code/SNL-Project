import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import Team from '../models/Team.js';
import Game from '../models/Game.js';
import axios from 'axios';

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

      // Roll the dice (1-6)
      const diceRoll = Math.floor(Math.random() * 6) + 1;
      const oldPosition = team.currentPosition;
      let newPosition = Math.min(oldPosition + diceRoll, 100);
      
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
        
        // Add image if available
        if (currentTask.imageUrl || currentTask.uploadedImageUrl) {
          const imageUrl = currentTask.uploadedImageUrl || currentTask.imageUrl;
          embed.setImage(imageUrl);
          taskField += '\n*See image above for visual reference*';
        }
        
        embed.addFields({ name: `📝 Tile ${newPosition} Task`, value: taskField });
      } else {
        embed.addFields({ name: `📝 Tile ${newPosition}`, value: 'No special task on this tile. Safe spot!' });
      }

      // Check for win condition
      if (newPosition === 100) {
        embed.addFields({ 
          name: '🏆 VICTORY!', 
          value: `**${team.teamName}** has reached tile 100 and won the game! 🎉` 
        });
        embed.setColor('#FFD700');
        
        // Update game status to completed
        game.status = 'completed';
        game.completedAt = new Date();
        game.winner = team.teamId;
        await game.save();
      } else {
        embed.addFields({ 
          name: '⏭️ Next Turn', 
          value: 'Your team is now locked from rolling until the next round. Wait for other teams to play!' 
        });
      }

      embed.setFooter({ text: `Game: ${game.name}` })
           .setTimestamp();

      // Fetch game board image from API
      let boardAttachment = null;
      try {
        const API_URL = process.env.API_URL || 'http://localhost:3000';
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

      // Send board image to game's original channel and all team channels
      try {
        // Get all teams for this game
        const allTeams = await Team.find({ gameId: game.gameId });
        
        // Send to game's original channel
        if (game.channelId && game.channelId !== interaction.channelId) {
          try {
            const gameChannel = await interaction.guild.channels.fetch(game.channelId);
            if (gameChannel) {
              const gameChannelEmbed = new EmbedBuilder()
                .setTitle(`🎲 ${team.teamName} Rolled!`)
                .setDescription(`**${interaction.user.displayName}** rolled **${diceRoll}** and moved from tile **${oldPosition}** to tile **${newPosition}**`)
                .setColor(embed.data.color)
                .setFooter({ text: `Game: ${game.name}` })
                .setTimestamp();
              
              if (boardAttachment) {
                gameChannelEmbed.setImage('attachment://gameboard.png');
              }
              
              const gameChannelOptions = { embeds: [gameChannelEmbed] };
              if (boardAttachment) {
                gameChannelOptions.files = [boardAttachment];
              }
              
              await gameChannel.send(gameChannelOptions);
            }
          } catch (error) {
            console.log('Could not post to game channel:', error);
          }
        }
        
        // Send to all other team channels (not the current one)
        for (const otherTeam of allTeams) {
          if (otherTeam.channelId !== interaction.channelId && otherTeam.teamId !== team.teamId) {
            try {
              const otherTeamChannel = await interaction.guild.channels.fetch(otherTeam.channelId);
              if (otherTeamChannel) {
                const teamChannelEmbed = new EmbedBuilder()
                  .setTitle(`🎲 ${team.teamName} Rolled!`)
                  .setDescription(`**${interaction.user.displayName}** rolled **${diceRoll}** and moved from tile **${oldPosition}** to tile **${newPosition}**`)
                  .setColor(embed.data.color)
                  .setFooter({ text: `Game: ${game.name}` })
                  .setTimestamp();
                
                if (boardAttachment) {
                  teamChannelEmbed.setImage('attachment://gameboard.png');
                }
                
                const teamChannelOptions = { embeds: [teamChannelEmbed] };
                if (boardAttachment) {
                  teamChannelOptions.files = [boardAttachment];
                }
                
                await otherTeamChannel.send(teamChannelOptions);
              }
            } catch (error) {
              console.log(`Could not post to team ${otherTeam.teamName} channel:`, error);
            }
          }
        }
      } catch (error) {
        console.log('Error broadcasting to other channels:', error);
      }

      // If this is NOT a team channel, also post in the current team's channel
      if (interaction.channelId !== team.channelId) {
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
      console.error('Error executing roll command:', error);
      await interaction.editReply({ 
        content: '❌ Failed to roll dice. Please try again later.'
      });
    }
  },
};
