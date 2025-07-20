import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import Game from '../models/Game.js';
import { hasModeratorPermissions, requireModeratorPermissions } from '../helpers/moderatorHelpers.js';

export default {
  data: new SlashCommandBuilder()
    .setName('snlresume')
    .setDescription('Resume a paused game - allows teams to roll again (Admin/Moderator only)'),

  async execute(interaction) {
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
          content: '❌ No active game found to resume.'
        });
      }

      if (!game.isPaused) {
        return await interaction.editReply({ 
          content: `❌ Game "${game.name}" is not paused. Teams can already roll dice.`
        });
      }

      // Resume the game
      game.isPaused = false;
      await game.save();

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle('▶️ Game Resumed')
        .setDescription(`**${game.name}** has been resumed!`)
        .addFields(
          { name: '🎮 Game Status', value: 'Active & Running', inline: true },
          { name: '✅ Rolling Status', value: 'Teams can now roll dice', inline: true },
          { name: '🎲 Next Action', value: 'Teams can use `/roll` command', inline: true }
        )
        .setColor('#00FF00') // Green color for resume
        .setFooter({ text: `Resumed by ${interaction.user.displayName}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Send notification to announcement channel if configured
      if (game.announcementChannelId) {
        try {
          const announcementChannel = await interaction.guild.channels.fetch(game.announcementChannelId);
          if (announcementChannel) {
            const announcementEmbed = new EmbedBuilder()
              .setTitle('▶️ Game Resumed')
              .setDescription(`**${game.name}** has been resumed! Teams can now continue rolling.`)
              .addFields({
                name: '🎲 Ready to Play',
                value: 'Team leaders can now use `/roll` to continue the game!',
                inline: false
              })
              .setColor('#00FF00')
              .setTimestamp();

            await announcementChannel.send({ embeds: [announcementEmbed] });
          }
        } catch (error) {
          console.log('Could not send resume announcement:', error);
        }
      }

    } catch (error) {
      console.error('Error resuming game:', error);
      await interaction.editReply({ 
        content: '❌ Failed to resume the game. Please try again later.'
      });
    }
  },
};
