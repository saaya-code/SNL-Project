import { SlashCommandBuilder } from 'discord.js';
import Game from '../models/Game.js';
import { requireModeratorPermissions } from '../helpers/moderatorHelpers.js';
import { getSingleActiveGame } from '../helpers/singleGameHelpers.js';

export default {
  data: new SlashCommandBuilder()
    .setName('snlsetpingrole')
    .setDescription('Set the role to ping in game announcements (Moderator only)')
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('The role to ping in announcements')
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

      const role = interaction.options.getRole('role');

      // Update the game with the ping role
      game.pingRoleId = role.id;
      await game.save();

      await interaction.editReply({
        content: `✅ **Ping Role Updated!**\n\n` +
                 `📢 Announcements will now ping: ${role}\n` +
                 `🎮 Game: **${game.name}**\n\n` +
                 `This role will be pinged for game announcements like rolls, wins, and other updates.`
      });

    } catch (error) {
      console.error('Error setting ping role:', error);
      await interaction.editReply({ 
        content: '❌ Failed to set ping role. Please try again later.'
      });
    }
  },
};
