import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } from 'discord.js';
import Game from '../models/Game.js';
import Application from '../models/Application.js';
import { requireModeratorPermissions } from '../helpers/moderatorHelpers.js';

export default {
  data: new SlashCommandBuilder()
    .setName('snlstart')
    .setDescription('Start a Snakes & Ladders game with accepted participants (Moderator only)'),

  async execute(interaction) {
    // Check moderator permissions
    if (!(await requireModeratorPermissions(interaction))) {
      return;
    }

    try {
      // Get all games that have accepted applications and are in registration status
      const gamesWithAcceptedApps = await Application.aggregate([
        { $match: { status: 'accepted' } },
        { $group: { _id: '$gameId', count: { $sum: 1 } } }
      ]);

      if (gamesWithAcceptedApps.length === 0) {
        return await interaction.editReply({ 
          content: '📭 No games found with accepted participants.'
        });
      }

      // Get game details for each game with accepted applications
      const gameIds = gamesWithAcceptedApps.map(g => g._id);
      const games = await Game.find({ 
        gameId: { $in: gameIds },
        status: 'registration'
      });

      if (games.length === 0) {
        return await interaction.editReply({ 
          content: '❌ No games in registration status with accepted participants found.'
        });
      }

      // Create dropdown menu for game selection
      const gameOptions = games.map(game => {
        const participantCount = gamesWithAcceptedApps.find(g => g._id === game.gameId)?.count || 0;
        return {
          label: game.name,
          description: `${participantCount} accepted participants | Team size: ${game.maxTeamSize || 'Not set'}`,
          value: `start_game_${game.gameId}`
        };
      }).slice(0, 25); // Discord limit

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_game_to_start')
        .setPlaceholder('Select a game to start')
        .addOptions(gameOptions);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const embed = new EmbedBuilder()
        .setTitle('🎮 Start Game - Select Game')
        .setDescription('Choose a game to start with accepted participants. This will:\n• Create randomized teams\n• Create private team channels\n• Assign team leaders and co-leaders\n• Begin the game!')
        .addFields(
          { name: '📊 Summary', value: `**${games.length}** games ready to start\n**${gamesWithAcceptedApps.reduce((sum, g) => sum + g.count, 0)}** total accepted participants` }
        )
        .setColor('#0099ff')
        .setTimestamp();

      await interaction.editReply({ 
        embeds: [embed], 
        components: [row] 
      });

    } catch (error) {
      console.error('Error fetching games to start:', error);
      await interaction.editReply({ 
        content: '❌ Failed to fetch games. Please try again later.'
      });
    }
  },
};
