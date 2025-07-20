import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import Team from '../models/Team.js';
import Game from '../models/Game.js';
import GameParameters from '../models/GameParameters.js';

export default {
  data: new SlashCommandBuilder()
    .setName('snlsubmit')
    .setDescription('Submit task completion proof for moderation (wins game if approved on tile 100!)')
    .addAttachmentOption(option =>
      option.setName('screenshot')
        .setDescription('Screenshot proving task completion')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Brief description of how you completed the task')
        .setRequired(false)
        .setMaxLength(500)
    ),

  async execute(interaction) {
    try {
      // Don't defer here - it's already deferred by the main handler

      // Find the user's team in any active game
      const userTeams = await Team.find({
        $or: [
          { 'leader.userId': interaction.user.id },
          { 'coLeader.userId': interaction.user.id }
        ]
      });

      if (userTeams.length === 0) {
        return await interaction.editReply({
          content: '❌ You are not a team leader or co-leader in any game.'
        });
      }

      // Find the team in an active game
      let activeTeam = null;
      let activeGame = null;

      for (const team of userTeams) {
        const game = await Game.findOne({ gameId: team.gameId, status: 'active' });
        if (game) {
          activeTeam = team;
          activeGame = game;
          break;
        }
      }

      if (!activeTeam || !activeGame) {
        return await interaction.editReply({
          content: '❌ You are not in an active game or you are not a team leader/co-leader.'
        });
      }

      // Check if team is at a valid position (not 0 or 100)
      if (activeTeam.currentPosition < 0 || activeTeam.currentPosition > 100) {
        return await interaction.editReply({
          content: '❌ You can only submit task completion proof when your team is on tiles 1-99.'
        });
      }

      // Get the attachment and description
      const screenshot = interaction.options.getAttachment('screenshot');
      const description = interaction.options.getString('description') || 'No description provided';

      // Validate attachment is an image
      if (!screenshot.contentType || !screenshot.contentType.startsWith('image/')) {
        return await interaction.editReply({
          content: '❌ Please upload an image file (PNG, JPG, GIF, etc.) as proof.'
        });
      }

      // Get game parameters for moderator role
      const gameParams = await GameParameters.findOne({ guildId: interaction.guild.id });
      const moderatorRole = gameParams?.moderatorRoleId ? `<@&${gameParams.moderatorRoleId}>` : '@Moderators';

      // Get current tile task info
      const currentTask = activeGame.tileTasks.get(activeTeam.currentPosition.toString());
      const taskInfo = currentTask ? 
        `**Task:** ${currentTask.description || currentTask.name || 'Custom task'}` : 
        `**Tile ${activeTeam.currentPosition}:** No specific task description`;

      // Create submission embed
      const submissionEmbed = new EmbedBuilder()
        .setTitle('🎯 Task Submission for Review')
        .setDescription(`**Team:** ${activeTeam.teamName}\n**Position:** Tile ${activeTeam.currentPosition}\n**Game:** ${activeGame.name}`)
        .addFields(
          { name: 'Current Tile Task', value: taskInfo, inline: false },
          { name: 'Submission Description', value: description, inline: false },
          { name: 'Submitted By', value: `${interaction.user.displayName} (${interaction.user.tag})`, inline: true },
          { name: 'Role', value: activeTeam.leader.userId === interaction.user.id ? 'Team Leader' : 'Co-Leader', inline: true }
        )
        .setImage(screenshot.url)
        .setColor(0x3498db)
        .setFooter({ text: `Team ID: ${activeTeam.teamId} | Game ID: ${activeGame.gameId}` })
        .setTimestamp();

      // Create approve/reject buttons
      const buttons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`approve_submission_${activeGame._id}_${interaction.user.id}`)
            .setLabel('✅ Approve')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`reject_submission_${activeGame._id}_${interaction.user.id}`)
            .setLabel('❌ Reject')
            .setStyle(ButtonStyle.Danger)
        );

      // Find the team's channel using the game name + team name convention
      // First try exact match with special character handling
      const gameNamePart = activeGame.name.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '-') // Replace special characters with hyphens
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
        .substring(0, 50);
        
      const teamNamePart = activeTeam.teamName.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '-') // Replace special characters with hyphens
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
        .substring(0, 50);
        
      // Try multiple possible channel name formats
      const possibleChannelNames = [
        `${gameNamePart}-${teamNamePart}`,
        `${gameNamePart}--${teamNamePart}`, // Double hyphen variant
        `${activeGame.name.toLowerCase().replace(/\s+/g, '-')}-${activeTeam.teamName.toLowerCase().replace(/\s+/g, '-')}`, // Simple replacement
      ];
      
      console.log(`Looking for team channel with possible names: ${possibleChannelNames.join(', ')}`);
      console.log(`Available channels: ${interaction.guild.channels.cache.filter(c => c.isTextBased()).map(c => c.name).join(', ')}`);
        
      let targetChannel = null;
      
      // Try to find channel by exact name match first
      for (const channelName of possibleChannelNames) {
        targetChannel = interaction.guild.channels.cache.find(
          channel => channel.name === channelName && channel.isTextBased()
        );
        if (targetChannel) break;
      }
      
      // If exact match fails, try partial matching (contains team name)
      if (!targetChannel) {
        const teamNameForSearch = activeTeam.teamName.toLowerCase().replace(/[^a-z0-9]/g, '');
        targetChannel = interaction.guild.channels.cache.find(
          channel => channel.isTextBased() && 
          channel.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(teamNameForSearch)
        );
      }
      
      // If team channel not found, use current channel as fallback
      if (!targetChannel) {
        targetChannel = interaction.channel;
        console.log(`Team channel not found with any naming convention, using current channel as fallback`);
      } else {
        console.log(`Found team channel: ${targetChannel.name}`);
      }

      // Send the submission message to team channel with approval buttons
      const submissionMessage = await targetChannel.send({
        embeds: [submissionEmbed],
        components: [buttons]
      });

      // Send notification to moderators in announcement channel (without buttons)
      if (activeGame.announcementChannelId && targetChannel.id !== activeGame.announcementChannelId) {
        try {
          const announcementChannel = await interaction.guild.channels.fetch(activeGame.announcementChannelId);
          if (announcementChannel) {
            const notificationEmbed = new EmbedBuilder()
              .setTitle('🔔 Task Submission Pending Review')
              .setDescription(`**Team:** ${activeTeam.teamName}\n**Position:** Tile ${activeTeam.currentPosition}\n**Game:** ${activeGame.name}`)
              .addFields(
                { name: 'Review Location', value: `Check ${targetChannel} for approval buttons`, inline: false },
                { name: 'Submitted By', value: `${interaction.user.displayName}`, inline: true }
              )
              .setColor(0xffa500) // Orange color for notifications
              .setTimestamp();

            await announcementChannel.send({
              content: `${moderatorRole} **Task submission requires review!**`,
              embeds: [notificationEmbed]
            });
          }
        } catch (error) {
          console.log('Could not send notification to announcement channel:', error);
        }
      }

      // Confirm to user
      await interaction.editReply({
        content: `✅ **Task submission sent for review!**\n\n📋 **Details:**\n• **Team:** ${activeTeam.teamName}\n• **Position:** Tile ${activeTeam.currentPosition}\n• **Screenshot:** Attached\n• **Description:** ${description}\n\n⏳ Waiting for moderator approval to continue rolling...`,
        ephemeral: true
      });

      // Set team to cannot roll until approved
      activeTeam.canRoll = false;
      await activeTeam.save();

    } catch (error) {
      console.error('Error executing snlsubmit command:', error);
      await interaction.editReply({
        content: '❌ An error occurred while processing your submission. Please try again.'
      });
    }
  },
};
