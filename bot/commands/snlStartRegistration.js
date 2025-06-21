import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';
import Game from '../models/Game.js';
import { requireModeratorPermissions } from '../helpers/moderatorHelpers.js';

export default {
  data: new SlashCommandBuilder()
    .setName('snlstartregistration')
    .setDescription('Start team registration for a Snakes & Ladders game (Moderator only)')
    .addIntegerOption(option =>
      option.setName('teamsize')
        .setDescription('Maximum team size (1-10)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(10)
    ),

  async execute(interaction) {
    const teamSize = interaction.options.getInteger('teamsize');

    // Check moderator permissions
    if (!(await requireModeratorPermissions(interaction))) {
      return;
    }

    try {
      // Find all pending games
      const pendingGames = await Game.find({ status: 'pending' });
      
      if (pendingGames.length === 0) {
        return await interaction.editReply({ 
          content: '❌ No pending games found. Please create a game first using `/snlcreate`.',
          flags: 64 
        });
      }

      if (pendingGames.length > 1) {
        return await interaction.editReply({ 
          content: `❌ Multiple pending games found. Please ensure only one game is pending at a time. Found: ${pendingGames.map(g => `**${g.name}**`).join(', ')}`,
          flags: 64 
        });
      }

      // Use the single pending game
      const game = pendingGames[0];

      // Update game status to registration
      game.status = 'registration';
      game.maxTeamSize = teamSize;
      await game.save();

      // Create registration embed
      const embed = new EmbedBuilder()
        .setTitle(`🎮 ${game.name} - Team Registration Open!`)
        .setDescription(`Registration is now open for **${game.name}**!\n\nClick the button below to apply for this game.`)
        .addFields(
          { name: '🎯 Game ID', value: game.gameId, inline: true },
          { name: '👥 Max Team Size', value: teamSize.toString(), inline: true },
          { name: '⏰ Application Deadline', value: game.applicationDeadline ? `<t:${Math.floor(game.applicationDeadline.getTime() / 1000)}:F>` : 'No deadline set', inline: true },
          { name: '🐍 Snakes', value: game.snakeCount?.toString() || '0', inline: true },
          { name: '🪜 Ladders', value: game.ladderCount?.toString() || '0', inline: true },
          { name: '📝 Tasks', value: `${Object.keys(game.tileTasks || {}).length}/100`, inline: true },
          { name: '📋 How to Apply', value: '• Click the "Join Game" button below\n• A private channel will be created for your application\n• Moderators will review your application\n• You\'ll be notified of the decision' }
        )
        .setColor('#00ff00')
        .setFooter({ text: `Started by ${interaction.user.displayName}` })
        .setTimestamp();

      // Create join button
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`join_game_${game.gameId}`)
            .setLabel('🎮 Join Game')
            .setStyle(ButtonStyle.Success)
        );

      await interaction.editReply({ 
        content: '✅ Game registration started successfully!',
        embeds: [embed], 
        components: [row] 
      });

    } catch (error) {
      console.error('Error starting game registration:', error);
      await interaction.editReply({ 
        content: '❌ Failed to start game registration. Please try again later.',
        flags: 64 
      });
    }
  },
};
