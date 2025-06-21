import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import Game from '../models/Game.js';
import Team from '../models/Team.js';
import axios from 'axios';

export default {
  data: new SlashCommandBuilder()
    .setName('snlboard')
    .setDescription('Shows current game board visually'),

  async execute(interaction) {
    try {
      // Find active games
      const activeGames = await Game.find({ status: 'active' });
      
      if (activeGames.length === 0) {
        return await interaction.editReply({ 
          content: '📭 No active games found.'
        });
      }

      // For now, show the first active game (since we enforce only one at a time)
      const game = activeGames[0];
      const teams = await Team.find({ gameId: game.gameId });

      // Fetch game board image from API
      const API_URL = process.env.API_URL || 'http://localhost:5000';
      
      try {
        const response = await axios.get(`${API_URL}/api/games/${game.gameId}/board`, {
          responseType: 'arraybuffer',
          timeout: 15000 // 15 second timeout
        });
        
        if (response.status === 200) {
          const imageBuffer = Buffer.from(response.data);
          const boardAttachment = new AttachmentBuilder(imageBuffer, { name: 'gameboard.png' });
          
          const embed = new EmbedBuilder()
            .setTitle(`🎲 ${game.name} - Current Board`)
            .setDescription(`**Status:** ${game.status.toUpperCase()}\n**Teams:** ${teams.length}`)
            .addFields(
              { name: '📊 Team Positions', value: teams.map(team => 
                `**${team.teamName}:** Tile ${team.currentPosition} ${team.canRoll ? '✅' : '🚫'}`
              ).join('\n') || 'No teams' },
              { name: '🎯 Game Stats', value: 
                `**Snakes:** ${game.snakeCount || 0}\n**Ladders:** ${game.ladderCount || 0}\n**Tasks:** ${Object.keys(game.tileTasks || {}).length}/100`
              }
            )
            .setImage('attachment://gameboard.png')
            .setColor('#00ff00')
            .setTimestamp();

          await interaction.editReply({ 
            embeds: [embed], 
            files: [boardAttachment] 
          });
        } else {
          throw new Error(`API returned status ${response.status}`);
        }
      } catch (apiError) {
        console.error('Failed to fetch game board image:', apiError.message);
        
        // Fallback: show text-based board info
        const embed = new EmbedBuilder()
          .setTitle(`🎲 ${game.name} - Current Board`)
          .setDescription(`**Status:** ${game.status.toUpperCase()}\n**Teams:** ${teams.length}\n\n⚠️ *Visual board unavailable - showing text summary*`)
          .addFields(
            { name: '📊 Team Positions', value: teams.map(team => 
              `**${team.teamName}:** Tile ${team.currentPosition} ${team.canRoll ? '✅ Can Roll' : '🚫 Waiting'}`
            ).join('\n') || 'No teams' },
            { name: '🎯 Game Stats', value: 
              `**Snakes:** ${game.snakeCount || 0}\n**Ladders:** ${game.ladderCount || 0}\n**Tasks:** ${Object.keys(game.tileTasks || {}).length}/100`
            },
            { name: '🐍 Snakes', value: Object.entries(game.snakes || {}).map(([head, tail]) => 
              `${head}→${tail}`
            ).join(', ') || 'None' },
            { name: '🪜 Ladders', value: Object.entries(game.ladders || {}).map(([bottom, top]) => 
              `${bottom}→${top}`
            ).join(', ') || 'None' }
          )
          .setColor('#ffaa00')
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      }

    } catch (error) {
      console.error('Error executing snlboard command:', error);
      await interaction.editReply({ 
        content: '❌ Failed to generate game board. Please try again later.'
      });
    }
  },
};
