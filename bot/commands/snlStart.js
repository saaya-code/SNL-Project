import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';
import Game from '../models/Game.js';

export default {
  data: new SlashCommandBuilder()
    .setName('snlstart')
    .setDescription('Start team registration for a Snakes & Ladders game (Admin only)')
    .addStringOption(option =>
      option.setName('gameid')
        .setDescription('The Game ID to start registration for')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('teamsize')
        .setDescription('Maximum team size (1-10)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(10)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const gameId = interaction.options.getString('gameid');
    const teamSize = interaction.options.getInteger('teamsize');

    // Check if user has admin permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.editReply({ 
        content: '❌ You need Administrator permissions to start game registration.',
        flags: 64 
      });
    }

    try {
      // Find the game
      const game = await Game.findOne({ gameId: gameId });
      if (!game) {
        return await interaction.editReply({ 
          content: `❌ Game with ID \`${gameId}\` not found.`,
          flags: 64 
        });
      }

      // Check if game is in pending status
      if (game.status !== 'pending') {
        return await interaction.editReply({ 
          content: `❌ Game "${game.name}" is not in pending status. Current status: ${game.status}`,
          flags: 64 
        });
      }

      // Update game status to registration
      game.status = 'registration';
      game.maxTeamSize = teamSize;
      await game.save();

      // Create registration embed
      const embed = new EmbedBuilder()
        .setTitle(`🎮 ${game.name} - Team Registration Open!`)
        .setDescription(`Registration is now open for **${game.name}**!\n\nClick the button below to apply for this game.`)
        .addFields(
          { name: '🎯 Game ID', value: gameId, inline: true },
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
            .setCustomId(`join_game_${gameId}`)
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
