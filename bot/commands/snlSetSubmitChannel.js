import { SlashCommandBuilder } from 'discord.js';
import Game from '../models/Game.js';
import { requireModeratorPermissions } from '../helpers/moderatorHelpers.js';
import { getSingleActiveGame } from '../helpers/singleGameHelpers.js';

export default {
  data: new SlashCommandBuilder()
    .setName('snlsetsubmitchannel')
    .setDescription('Set the channel where task submissions are allowed (Moderator only)')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The channel to allow task submissions in')
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      // Check moderator permissions
      if (!(await requireModeratorPermissions(interaction))) {
        return;
      }

      // Find the active game
      const game = await getSingleActiveGame();
      if (!game) {
        return await interaction.editReply({ 
          content: '❌ No active game found. Create and start a game first.'
        });
      }

      const channel = interaction.options.getChannel('channel');

      // Validate that it's a text channel
      if (channel.type !== 0) { // 0 = GUILD_TEXT
        return await interaction.editReply({
          content: '❌ Please select a text channel for task submissions.'
        });
      }

      // Update the game with the submit channel
      game.submitChannelId = channel.id;
      await game.save();

      await interaction.editReply({
        content: `✅ **Submit Channel Updated!**\n\n` +
                 `📝 Task submissions are now only allowed in: ${channel}\n` +
                 `🎮 Game: **${game.name}**\n\n` +
                 `Players can use \`/snlsubmit\` only in this channel to submit task completions.`
      });

    } catch (error) {
      console.error('Error setting submit channel:', error);
      await interaction.editReply({ 
        content: '❌ Failed to set submit channel. Please try again later.'
      });
    }
  },
};
