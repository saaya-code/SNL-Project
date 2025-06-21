import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import Game from '../models/Game.js';
import Team from '../models/Team.js';

export default {
  data: new SlashCommandBuilder()
    .setName('snlteams')
    .setDescription('Lists all team statuses for active games'),

  async execute(interaction) {
    try {
      // Find active games
      const activeGames = await Game.find({ status: 'active' });
      
      if (activeGames.length === 0) {
        return await interaction.editReply({ 
          content: '📭 No active games found.'
        });
      }

      // For each active game, get teams
      for (const game of activeGames) {
        const teams = await Team.find({ gameId: game.gameId }).sort({ currentPosition: -1 });
        
        if (teams.length === 0) {
          continue;
        }

        const embed = new EmbedBuilder()
          .setTitle(`🏆 ${game.name} - Team Status`)
          .setDescription(`Game Status: **${game.status.toUpperCase()}**`)
          .setColor('#0099ff')
          .setTimestamp();

        // Add team information
        const teamFields = teams.map((team, index) => {
          const position = index + 1;
          const positionEmoji = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;
          const rollStatus = team.canRoll ? '✅ Can Roll' : '🚫 Cannot Roll';
          
          return {
            name: `${positionEmoji} ${team.teamName}`,
            value: `**Position:** Tile ${team.currentPosition}\n**Leader:** ${team.leader.displayName}\n**Co-Leader:** ${team.coLeader.displayName}\n**Members:** ${team.members.length}\n**Status:** ${rollStatus}`,
            inline: true
          };
        });

        // Discord embed limit is 25 fields
        const fieldChunks = [];
        for (let i = 0; i < teamFields.length; i += 25) {
          fieldChunks.push(teamFields.slice(i, i + 25));
        }

        // Send first chunk
        embed.addFields(fieldChunks[0]);
        await interaction.editReply({ embeds: [embed] });

        // Send additional chunks as follow-ups if needed
        for (let i = 1; i < fieldChunks.length; i++) {
          const followUpEmbed = new EmbedBuilder()
            .setTitle(`🏆 ${game.name} - Team Status (continued)`)
            .addFields(fieldChunks[i])
            .setColor('#0099ff');
          
          await interaction.followUp({ embeds: [followUpEmbed] });
        }
      }

    } catch (error) {
      console.error('Error executing snlteams command:', error);
      await interaction.editReply({ 
        content: '❌ Failed to fetch team statuses. Please try again later.'
      });
    }
  },
};
