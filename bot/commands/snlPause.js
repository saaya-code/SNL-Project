import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import Game from '../models/Game.js';
import { hasModeratorPermissions, requireModeratorPermissions } from '../helpers/moderatorHelpers.js';

export default {
  data: new SlashCommandBuilder()
    .setName('snlpause')
    .setDescription('Pause the active game - prevents teams from rolling (Admin/Moderator only)'),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      // Check permissions
      if (!(await requireModeratorPermissions(interaction))) {
        return;
      }

      // Find active game in this guild
      const game = await Game.findOne({
        status: 'active'
      });

      if (!game) {
        return await interaction.editReply({ 
          content: '❌ No active game found to pause.'
        });
      }

      if (game.isPaused) {
        return await interaction.editReply({ 
          content: `❌ Game "${game.name}" is already paused. Use \`/snlresume\` to resume it.`
        });
      }

      // Pause the game
      game.isPaused = true;
      await game.save();

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle('⏸️ Game Paused')
        .setDescription(`**${game.name}** has been paused by an administrator.`)
        .addFields(
          { name: '🎮 Game Status', value: 'Active but Paused', inline: true },
          { name: '🚫 Rolling Status', value: 'Teams cannot roll dice', inline: true },
          { name: '▶️ To Resume', value: 'Use `/snlresume` command', inline: true }
        )
        .setColor('#FF8C00') // Orange color for pause
        .setFooter({ text: `Paused by ${interaction.user.displayName}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Send notification to announcement channel if configured
      if (game.announcementChannelId) {
        try {
          const announcementChannel = await interaction.guild.channels.fetch(game.announcementChannelId);
          if (announcementChannel) {
            const announcementEmbed = new EmbedBuilder()
              .setTitle('⏸️ Game Paused')
              .setDescription(`**${game.name}** has been paused. Teams cannot roll until the game is resumed.`)
              .addFields({
                name: '⚠️ Notice',
                value: 'Please wait for an administrator to resume the game before attempting to roll.',
                inline: false
              })
              .setColor('#FF8C00')
              .setTimestamp();

            await announcementChannel.send({ embeds: [announcementEmbed] });
          }
        } catch (error) {
          console.log('Could not send pause announcement:', error);
        }
      }

    } catch (error) {
      console.error('Error pausing game:', error);
      await interaction.editReply({ 
        content: '❌ Failed to pause the game. Please try again later.'
      });
    }
  },
};
