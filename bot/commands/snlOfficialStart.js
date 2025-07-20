import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import Game from '../models/Game.js';
import Team from '../models/Team.js';
import { hasModeratorPermissions, requireModeratorPermissions } from '../helpers/moderatorHelpers.js';

export default {
  data: new SlashCommandBuilder()
    .setName('snlofficialstart')
    .setDescription('Officially start the game - allows teams to roll dice (Admin/Moderator only)'),

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
          content: '❌ No active game found. Start a game first with `/snlstart`.'
        });
      }

      if (game.isOfficiallyStarted) {
        return await interaction.editReply({ 
          content: `❌ Game "${game.name}" is already officially started. Teams can already roll dice.`
        });
      }

      // Get teams for this game
      const teams = await Team.find({ gameId: game.gameId });
      
      if (teams.length === 0) {
        return await interaction.editReply({ 
          content: `❌ No teams found for game "${game.name}". Teams must be created before officially starting.`
        });
      }

      // Officially start the game
      game.isOfficiallyStarted = true;
      await game.save();

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle('🏁 Game Officially Started!')
        .setDescription(`**${game.name}** has been officially started!`)
        .addFields(
          { name: '🎮 Game Status', value: 'Active & Started', inline: true },
          { name: '👥 Teams Created', value: teams.length.toString(), inline: true },
          { name: '🎲 Rolling Enabled', value: 'Teams can now roll dice!', inline: true }
        )
        .setColor('#00FF00')
        .setFooter({ text: `Started by ${interaction.user.displayName}` })
        .setTimestamp();

      // Add team information
      const teamInfo = teams.map(team => 
        `**${team.teamName}** (${team.members.length} members) - Position: ${team.currentPosition}`
      ).join('\n');

      if (teamInfo.length < 1024) {
        embed.addFields({ name: '📊 Team Status', value: teamInfo });
      }

      await interaction.editReply({ embeds: [embed] });

      // Send notification to announcement channel if configured
      if (game.announcementChannelId) {
        try {
          const announcementChannel = await interaction.guild.channels.fetch(game.announcementChannelId);
          if (announcementChannel) {
            const announcementEmbed = new EmbedBuilder()
              .setTitle('🏁 Game Officially Started!')
              .setDescription(`**${game.name}** is now officially active! Teams can start rolling dice with \`/roll\``)
              .addFields(
                { name: '👥 Teams Ready', value: teams.length.toString(), inline: true },
                { name: '🎲 How to Play', value: 'Team leaders use `/roll` to move forward!', inline: true }
              )
              .setColor('#00FF00')
              .setTimestamp();

            const messageOptions = { embeds: [announcementEmbed] };
            
            // Add role ping if configured
            if (game.pingRoleId) {
              messageOptions.content = `<@&${game.pingRoleId}>`;
            }

            await announcementChannel.send(messageOptions);
          }
        } catch (error) {
          console.log('Could not send announcement:', error);
        }
      }

    } catch (error) {
      console.error('Error officially starting game:', error);
      await interaction.editReply({ 
        content: '❌ Failed to officially start the game. Please try again later.'
      });
    }
  },
};
