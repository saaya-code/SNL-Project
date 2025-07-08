import { SlashCommandBuilder } from 'discord.js';
import Game from '../models/Game.js';
import { requireModeratorPermissions } from '../helpers/moderatorHelpers.js';

export default {
  data: new SlashCommandBuilder()
    .setName('snlsetchannel')
    .setDescription('Set the announcement channel for game roll announcements (Moderator only)')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The channel where announcements will be sent')
        .setRequired(true)
    ),

  async execute(interaction) {
    // Check moderator permissions
    if (!(await requireModeratorPermissions(interaction))) {
      return;
    }

    const channel = interaction.options.getChannel('channel');
    
    // Check if channel is a text channel
    if (!channel || channel.type !== 0) { // 0 = GUILD_TEXT
      return await interaction.editReply({
        content: '❌ Please select a valid text channel for announcements.'
      });
    }

    try {
      // Find the most recent active or registration game
      const game = await Game.findOne({
        status: { $in: ['registration', 'active'] }
      }).sort({ createdAt: -1 });

      if (!game) {
        return await interaction.editReply({
          content: '❌ No active or registration game found. Please create a game first.'
        });
      }

      // Update the game with the announcement channel
      game.announcementChannelId = channel.id;
      await game.save();

      await interaction.editReply({
        content: `✅ Announcement channel set to ${channel} for game **${game.name}**.\n\nAll team rolls will be announced in this channel!`
      });

    } catch (error) {
      console.error('Error setting announcement channel:', error);
      await interaction.editReply({
        content: '❌ Failed to set announcement channel. Please try again.'
      });
    }
  }
};
