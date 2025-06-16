import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } from 'discord.js';
import Game from '../models/Game.js';
import Application from '../models/Application.js';

export default {
  data: new SlashCommandBuilder()
    .setName('snlaccept')
    .setDescription('Accept pending applications for SNL games (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    // Check if user has admin permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.editReply({ 
        content: '❌ You need Administrator permissions to manage applications.'
      });
    }

    try {
      // Get all games that have pending applications
      const gamesWithApplications = await Application.aggregate([
        { $match: { status: 'pending' } },
        { $group: { _id: '$gameId', count: { $sum: 1 } } }
      ]);

      if (gamesWithApplications.length === 0) {
        return await interaction.editReply({ 
          content: '📭 No pending applications found across all games.'
        });
      }

      // Get game details for each game with applications
      const gameIds = gamesWithApplications.map(g => g._id);
      const games = await Game.find({ gameId: { $in: gameIds } });

      if (games.length === 0) {
        return await interaction.editReply({ 
          content: '❌ No games found for pending applications.'
        });
      }

      // Create dropdown menu for game selection
      const gameOptions = games.map(game => {
        const appCount = gamesWithApplications.find(g => g._id === game.gameId)?.count || 0;
        return {
          label: game.name,
          description: `${appCount} pending application${appCount !== 1 ? 's' : ''} | Status: ${game.status}`,
          value: `accept_game_${game.gameId}`
        };
      }).slice(0, 25); // Discord limit

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_game_accept')
        .setPlaceholder('Select a game to accept applications')
        .addOptions(gameOptions);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const embed = new EmbedBuilder()
        .setTitle('🎮 Accept Applications - Select Game')
        .setDescription('Choose a game to view and accept pending applications.')
        .addFields(
          { name: '📊 Summary', value: `**${games.length}** games with pending applications\n**${gamesWithApplications.reduce((sum, g) => sum + g.count, 0)}** total pending applications` }
        )
        .setColor('#00ff00')
        .setTimestamp();

      await interaction.editReply({ 
        embeds: [embed], 
        components: [row] 
      });

    } catch (error) {
      console.error('Error fetching applications:', error);
      await interaction.editReply({ 
        content: '❌ Failed to fetch applications. Please try again later.'
      });
    }
  },
};
