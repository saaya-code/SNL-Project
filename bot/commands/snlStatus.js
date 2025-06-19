import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import Team from '../models/Team.js';
import Game from '../models/Game.js';

export default {
  data: new SlashCommandBuilder()
    .setName('snlstatus')
    .setDescription('Check the current status of a Snakes & Ladders game')
    .addStringOption(option =>
      option.setName('gameid')
        .setDescription('The Game ID to check status for')
        .setRequired(true)
    ),

  async execute(interaction) {
    const gameId = interaction.options.getString('gameid');

    try {
      // Find the game
      const game = await Game.findOne({ gameId: gameId });
      if (!game) {
        return await interaction.editReply({ 
          content: `❌ Game with ID \`${gameId}\` not found.`
        });
      }

      // Find all teams for this game
      const teams = await Team.find({ gameId: gameId }).sort({ currentPosition: -1 });

      // Create status embed
      const embed = new EmbedBuilder()
        .setTitle(`📊 ${game.name} - Game Status`)
        .setColor(game.status === 'active' ? '#00ff00' : game.status === 'completed' ? '#FFD700' : '#0099ff')
        .setTimestamp();

      // Add game info
      embed.addFields(
        { name: '🎮 Game ID', value: gameId, inline: true },
        { name: '📈 Status', value: game.status.charAt(0).toUpperCase() + game.status.slice(1), inline: true },
        { name: '🏆 Teams', value: teams.length.toString(), inline: true }
      );

      if (game.status === 'active' && teams.length > 0) {
        // Add team positions
        const teamPositions = teams.map((team, index) => {
          const position = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
          const rollStatus = team.canRoll ? '🎲 Can roll' : '🚫 Waiting';
          return `${position} **${team.teamName}** - Tile ${team.currentPosition}\n   ${rollStatus} | Leader: ${team.leader.displayName}`;
        }).join('\n\n');

        embed.addFields({ name: '🏁 Team Standings', value: teamPositions });

        // Add rolling status summary
        const canRollCount = teams.filter(team => team.canRoll).length;
        const waitingCount = teams.length - canRollCount;
        
        embed.addFields({
          name: '🎲 Rolling Status',
          value: `✅ Ready to roll: ${canRollCount} teams\n🚫 Waiting: ${waitingCount} teams`,
          inline: true
        });

        // Add game progress
        const maxPosition = Math.max(...teams.map(team => team.currentPosition));
        const progress = Math.round((maxPosition / 100) * 100);
        embed.addFields({
          name: '📈 Game Progress',
          value: `${progress}% complete\nLeading team at tile ${maxPosition}/100`,
          inline: true
        });

      } else if (game.status === 'completed') {
        // Show winner information
        const winnerTeam = teams.find(team => team.teamId === game.winner) || teams[0];
        embed.addFields({
          name: '🏆 Winner',
          value: `**${winnerTeam?.teamName || 'Unknown'}** reached tile 100!`,
          inline: true
        });
        
        if (game.completedAt) {
          embed.addFields({
            name: '⏰ Completed',
            value: `<t:${Math.floor(game.completedAt.getTime() / 1000)}:R>`,
            inline: true
          });
        }

        // Final standings
        if (teams.length > 0) {
          const finalStandings = teams.map((team, index) => {
            const position = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            return `${position} **${team.teamName}** - Tile ${team.currentPosition}`;
          }).join('\n');

          embed.addFields({ name: '🏁 Final Standings', value: finalStandings });
        }

      } else if (game.status === 'registration') {
        embed.addFields({
          name: '📝 Registration Phase',
          value: 'Game is currently accepting applications. Use `/snlstart` to begin the game with accepted participants.',
        });

      } else if (game.status === 'pending') {
        embed.addFields({
          name: '⏳ Pending',
          value: 'Game is created but not yet open for registration. Use `/snlstartregistration` to open applications.',
        });
      }

      // Add game details
      if (game.snakeCount || game.ladderCount) {
        embed.addFields({
          name: '🎯 Game Elements',
          value: `🐍 Snakes: ${game.snakeCount}\n🪜 Ladders: ${game.ladderCount}\n📝 Tasks: ${Object.keys(game.tileTasks || {}).length}`,
          inline: true
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error checking game status:', error);
      await interaction.editReply({ 
        content: '❌ Failed to check game status. Please try again later.'
      });
    }
  },
};
