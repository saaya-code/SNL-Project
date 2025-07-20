import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import Game from '../models/Game.js';
import Team from '../models/Team.js';
import { requireModeratorPermissions } from '../helpers/moderatorHelpers.js';
import { setupGameChannels } from '../helpers/gameStartHandlers.js';

export default {
  data: new SlashCommandBuilder()
    .setName('snlsetup')
    .setDescription('Setup channels for teams and announcements (Moderator only)'),

  async execute(interaction) {
    // Check moderator permissions
    if (!(await requireModeratorPermissions(interaction))) {
      return;
    }

    try {
      // Get the single active game
      const game = await Game.findOne({ status: 'active' });
      
      if (!game) {
        return await interaction.editReply({ 
          content: '❌ No active game found. Use `/snlstart` to create and activate a game first.'
        });
      }

      // Check if channels are already set up
      if (game.channelsSetup) {
        return await interaction.editReply({ 
          content: `⚠️ Channels for game "${game.name}" have already been set up.\n\nNext step: Use \`/snlofficialstart\` to allow teams to start rolling dice.`
        });
      }

      // Get existing teams for this game
      const teams = await Team.find({ gameId: game.gameId });

      if (teams.length === 0) {
        return await interaction.editReply({ 
          content: `❌ No teams found for game "${game.name}". Teams must be distributed before setting up channels.\n\nUse \`/snlstart\` to create teams from accepted applications first.`
        });
      }

      // Separate teams that need channels from those that already have them
      const teamsNeedingChannels = teams.filter(team => 
        team.channelId === 'dashboard-team' || 
        team.channelId === 'dashboard-created' || 
        !team.channelId
      );
      const teamsWithChannels = teams.filter(team => 
        team.channelId && 
        team.channelId !== 'dashboard-team' && 
        team.channelId !== 'dashboard-created'
      );

      let channelsCreated = 0;
      let totalParticipants = 0;
      let announcementChannelId = null;

      // If some teams already have channels, just create channels for the remaining ones
      if (teamsNeedingChannels.length > 0) {
        // Setup channels for teams that need them
        const result = await setupGameChannels(interaction, game.gameId, teamsNeedingChannels);
        
        if (result.success) {
          channelsCreated = result.channelsCreated || result.teamsCreated;
          totalParticipants = result.totalParticipants;
          announcementChannelId = result.announcementChannelId;
        } else {
          return await interaction.editReply({ 
            content: `❌ Failed to setup channels: ${result.error}`
          });
        }
      }

      // Count total participants across all teams
      if (totalParticipants === 0) {
        for (const team of teams) {
          let teamSize = 0;
          if (team.leader) teamSize++;
          if (team.coLeader) teamSize++;
          if (team.members && Array.isArray(team.members)) teamSize += team.members.length;
          totalParticipants += teamSize;
        }
      }

      // Get announcement channel (create if needed for existing setup)
      if (!announcementChannelId) {
        try {
          let announcementsChannel = interaction.guild.channels.cache.find(
            channel => channel.name.toLowerCase() === 'snl-announcements'
          );
          
          if (!announcementsChannel) {
            announcementsChannel = await interaction.guild.channels.create({
              name: 'snl-announcements',
              type: 0, // Text channel
              topic: `Game announcements for ${game.name}`,
              permissionOverwrites: [
                {
                  id: interaction.guild.roles.everyone,
                  allow: ['ViewChannel', 'ReadMessageHistory'],
                  deny: ['SendMessages']
                }
              ]
            });
          }
          announcementChannelId = announcementsChannel.id;
        } catch (error) {
          console.error('Error creating announcements channel:', error);
        }
      }

      // Mark channels as set up
      game.channelsSetup = true;
      await game.save();

      const statusMessage = teamsNeedingChannels.length > 0 
        ? `Created ${channelsCreated} new team channels`
        : 'All teams already have channels assigned';

      const embed = new EmbedBuilder()
        .setTitle('🛠️ Game Channels Setup Complete!')
        .setDescription(`Channels have been successfully set up for **${game.name}**`)
        .addFields(
          { name: '📊 Status', value: statusMessage, inline: false },
          { name: '🏆 Total Teams', value: `${teams.length}`, inline: true },
          { name: '👥 Total Participants', value: `${totalParticipants}`, inline: true }
        )
        .setColor('#00ff00')
        .setTimestamp();

      if (announcementChannelId) {
        embed.addFields({ 
          name: '📢 Announcement Channel', 
          value: `<#${announcementChannelId}>`, 
          inline: false 
        });
      }

      embed.addFields({ 
        name: '🎯 Next Step', 
        value: 'Use `/snlofficialstart` to allow teams to start rolling dice!', 
        inline: false 
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in snlsetup command:', error);
      await interaction.editReply({ 
        content: '❌ An error occurred while setting up the game channels. Please try again or contact an administrator.'
      });
    }
  },
};
