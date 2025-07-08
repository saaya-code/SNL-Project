import { SlashCommandBuilder } from 'discord.js';
import Game from '../models/Game.js';
import { requireModeratorPermissions } from '../helpers/moderatorHelpers.js';

export default {
  data: new SlashCommandBuilder()
    .setName('snlsetannouncement')
    .setDescription('Set the announcement channel for game roll updates (Moderator only)')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The channel where roll announcements will be sent')
        .setRequired(true)
    ),

  async execute(interaction) {
    // Check moderator permissions
    if (!(await requireModeratorPermissions(interaction))) {
      return;
    }

    const channel = interaction.options.getChannel('channel');
    
    // Check if channel is a text channel
    if (channel.type !== 0) { // 0 = GUILD_TEXT
      return await interaction.editReply({
        content: '❌ Please select a text channel for announcements.'
      });
    }

    try {
      // Find the active or pending game
      const game = await Game.findOne({
        status: { $in: ['pending', 'registration', 'active'] }
      }).sort({ createdAt: -1 });

      if (!game) {
        return await interaction.editReply({
          content: '❌ No active game found. Please create a game first.'
        });
      }

      // Update the game's announcement channel
      game.announcementChannelId = channel.id;
      await game.save();

      return await interaction.editReply({
        content: `✅ Announcement channel for game **${game.name}** has been set to ${channel}.\n\n⚠️ **Note:** To receive announcements from dashboard rolls, please also set the webhook URL in the dashboard's announcement settings.\n\nBot-initiated rolls will be posted directly to this channel.`
      });

    } catch (error) {
      console.error('Error setting announcement channel:', error);
      return await interaction.editReply({
        content: '❌ Failed to set announcement channel. Please try again later.'
      });
    }
  },
};
