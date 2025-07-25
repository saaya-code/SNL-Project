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

      // Check if game has officially started (teams can take actions)
      if (!activeGame.isOfficiallyStarted) {
        return await interaction.editReply({
          content: `⏳ Game "${activeGame.name}" is active but has not officially started yet. Please wait for a moderator to officially start the game before submitting tasks.`
        });
      }

      // Check if game is paused
      if (activeGame.isPaused) {
        return await interaction.editReply({
          content: `⏸️ Game "${activeGame.name}" is currently paused. Task submissions are disabled until the game is resumed.`
        });
      }

      // Check if game has already been won
      if (activeGame.winnerTeamId) {
        const winnerTeam = await Team.findOne({ teamId: activeGame.winnerTeamId });
        return await interaction.editReply({
          content: `🏆 Game "${activeGame.name}" has already been won by **${winnerTeam?.teamName || 'Unknown Team'}**! No more submissions allowed.`
        });
      }

      // Check if submissions are restricted to a specific channel
      if (activeGame.submitChannelId && interaction.channelId !== activeGame.submitChannelId) {
        const submitChannel = await interaction.guild.channels.fetch(activeGame.submitChannelId).catch(() => null);
        const channelMention = submitChannel ? `${submitChannel}` : `channel ID: ${activeGame.submitChannelId}`;
        return await interaction.editReply({
          content: `📝 **Task submissions are restricted!**\n\nYou can only submit tasks in: ${channelMention}\n\nPlease use \`/snlsubmit\` in the designated submission channel.`
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

      // Check if submit channel is configured
      if (!activeGame.submitChannelId) {
        // No submit channel configured - ping moderator
        return await interaction.editReply({
          content: `❌ **Submit channel not configured!**\n\n${moderatorRole} Please use \`/snlsetsubmitchannel\` to set a designated channel for task submissions before teams can submit tasks.`
        });
      }

      // Validate that the submission is being made in the correct channel
      if (interaction.channelId !== activeGame.submitChannelId) {
        const submitChannel = await interaction.guild.channels.fetch(activeGame.submitChannelId);
        return await interaction.editReply({
          content: `❌ **Wrong channel!** Task submissions must be made in ${submitChannel}. Please go there and use \`/snlsubmit\` again.`
        });
      }

      // Check if any moderators are online
      let onlineModerators = [];
      if (gameParams?.moderatorRoleId) {
        const modRole = await interaction.guild.roles.fetch(gameParams.moderatorRoleId);
        if (modRole) {
          onlineModerators = modRole.members.filter(member => !member.user.bot && member.presence?.status === 'online');
        }
      }
      console.log('Online moderators:', onlineModerators.map(m => m.user.tag));
      // Auto-approve if no moderators are online
      if (onlineModerators.map(m => m.user.tag).length === 0) {
        // Auto-approve the submission
        activeTeam.canRoll = true;
        await activeTeam.save();

        // Check if team reached tile 100 and auto-approve win
        let winMessage = '';
        if (activeTeam.currentPosition === 100) {
          activeGame.winnerTeamId = activeTeam.teamId;
          activeGame.status = 'completed';
          await activeGame.save();

          // Disable rolling for all teams in this game
          await Team.updateMany(
            { gameId: activeGame.gameId },
            { canRoll: false }
          );

          winMessage = '\n\n🏆 **CONGRATULATIONS!** Your team has won the game!';
        }

        // Create auto-approval embed
        const autoApprovalEmbed = new EmbedBuilder()
          .setTitle('✅ Task Auto-Approved (No Moderators Online)')
          .setDescription(`**Team:** ${activeTeam.teamName}\n**Position:** Tile ${activeTeam.currentPosition}\n**Game:** ${activeGame.name}`)
          .addFields(
            { name: 'Auto-Approval Notice', value: '⚠️ **Since no moderators are currently online, your submission has been automatically approved.**', inline: false },
            { name: 'Important Warning', value: '🚨 **Any abuse of this system will result in team elimination. A moderator will review this submission when they come online.**', inline: false },
            { name: 'Screenshot Submitted', value: 'Screenshot has been logged for moderator review', inline: true },
            { name: 'Description', value: description, inline: true },
            { name: 'Status', value: activeTeam.currentPosition === 100 ? '🏆 Game Won!' : '🎲 Can Roll Again', inline: true }
          )
          .setImage(screenshot.url)
          .setColor(activeTeam.currentPosition === 100 ? '#FFD700' : '#00FF00')
          .setFooter({ text: `Auto-approved at ${new Date().toLocaleString()} | Team ID: ${activeTeam.teamId}` })
          .setTimestamp();

        // Send auto-approval to submit channel
        const submitChannel = await interaction.guild.channels.fetch(activeGame.submitChannelId);
        await submitChannel.send({
          content: `🤖 **AUTO-APPROVAL** (No moderators online)\n${moderatorRole} Please review when available`,
          embeds: [autoApprovalEmbed]
        });

        // Send to announcements if it's a win or different channel
        if (activeGame.announcementChannelId && 
            (activeGame.announcementChannelId !== activeGame.submitChannelId || activeTeam.currentPosition === 100)) {
          try {
            const announcementChannel = await interaction.guild.channels.fetch(activeGame.announcementChannelId);
            if (announcementChannel) {
              const announceEmbed = new EmbedBuilder()
                .setTitle(activeTeam.currentPosition === 100 ? '🏆 GAME WON!' : '🤖 Auto-Approved Submission')
                .setDescription(`**${activeTeam.teamName}** ${activeTeam.currentPosition === 100 ? 'has won the game!' : 'had their task auto-approved'}`)
                .addFields(
                  { name: 'Position', value: `Tile ${activeTeam.currentPosition}`, inline: true },
                  { name: 'Reason', value: 'No moderators online', inline: true },
                  { name: 'Status', value: activeTeam.currentPosition === 100 ? 'Game Complete' : 'Can continue rolling', inline: true },
                  activeTeam.currentPosition != 100 ? { name: 'Description', value: description || 'No description provided', inline: true } : {}
                )
                .setImage(screenshot.url)
                .setFooter({ text: `Team ID: ${activeTeam.teamId} | Game ID: ${activeGame.gameId}` })
                .setColor(activeTeam.currentPosition === 100 ? '#FFD700' : '#FFA500')
                .setTimestamp();

              const messageOptions = { embeds: [announceEmbed] };
              
              // Add role ping if configured
              if (activeGame.pingRoleId) {
                messageOptions.content = `<@&${activeGame.pingRoleId}> ${activeTeam.currentPosition === 100 ? 'Game completed!' : 'Auto-approved submission!'}`;
              }

              await announcementChannel.send(messageOptions);
            }
          } catch (error) {
            console.log('Could not send auto-approval announcement:', error);
          }
        }

        // Confirm to user
        return await interaction.editReply({
          content: `✅ **Task Auto-Approved!**${winMessage}\n\n` +
                   `🤖 **No moderators are currently online, so your submission has been automatically approved.**\n\n` +
                   `⚠️ **WARNING:** Any abuse of this auto-approval system will result in team elimination. A moderator will review your submission when they come online.\n\n` +
                   `📋 **Details:**\n• **Team:** ${activeTeam.teamName}\n• **Position:** Tile ${activeTeam.currentPosition}\n• **Status:** ${activeTeam.currentPosition === 100 ? '🏆 Game Won!' : '🎲 Can Roll Again'}`
        });
      }

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

      // Send the submission message to the designated submit channel with approval buttons
      const submitChannel = await interaction.guild.channels.fetch(activeGame.submitChannelId);
      const submissionMessage = await submitChannel.send({
        content: `${moderatorRole} **Task submission requires review!**`,
        embeds: [submissionEmbed],
        components: [buttons]
      });

      // Send notification to team channel if it exists and is different from submit channel
      try {
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
        
        let teamChannel = null;
        
        // Try to find channel by exact name match first
        for (const channelName of possibleChannelNames) {
          teamChannel = interaction.guild.channels.cache.find(
            channel => channel.name === channelName && channel.isTextBased()
          );
          if (teamChannel) break;
        }
        
        // If exact match fails, try partial matching (contains team name)
        if (!teamChannel) {
          const teamNameForSearch = activeTeam.teamName.toLowerCase().replace(/[^a-z0-9]/g, '');
          teamChannel = interaction.guild.channels.cache.find(
            channel => channel.isTextBased() && 
            channel.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(teamNameForSearch)
          );
        }
        
        // Send notification to team channel if found and different from submit channel
        if (teamChannel && teamChannel.id !== activeGame.submitChannelId) {
          const teamNotificationEmbed = new EmbedBuilder()
            .setTitle('📝 Task Submission Sent')
            .setDescription(`Your task submission has been sent for moderator review!`)
            .addFields(
              { name: 'Position', value: `Tile ${activeTeam.currentPosition}`, inline: true },
              { name: 'Review Location', value: `${submitChannel}`, inline: true },
              { name: 'Status', value: '⏳ Awaiting Approval', inline: true }
            )
            .setColor(0x3498db)
            .setTimestamp();

          await teamChannel.send({ embeds: [teamNotificationEmbed] });
        }
      } catch (error) {
        console.log('Could not send notification to team channel:', error);
      }

      // Send notification to announcement channel if it exists and is different from submit channel
      if (activeGame.announcementChannelId && activeGame.announcementChannelId !== activeGame.submitChannelId) {
        try {
          const announcementChannel = await interaction.guild.channels.fetch(activeGame.announcementChannelId);
          if (announcementChannel) {
            const notificationEmbed = new EmbedBuilder()
              .setTitle('🔔 Task Submission Pending Review')
              .setDescription(`**Team:** ${activeTeam.teamName}\n**Position:** Tile ${activeTeam.currentPosition}\n**Game:** ${activeGame.name}`)
              .addFields(
                { name: 'Review Location', value: `Check ${submitChannel} for approval buttons`, inline: false },
                { name: 'Submitted By', value: `${interaction.user.displayName}`, inline: true },
                { name: 'Description', value: description || 'No description provided', inline: true }
              )
              .setImage(screenshot.url)
              .setFooter({ text: `Team ID: ${activeTeam.teamId} | Game ID: ${activeGame.gameId}` })
              .setColor(0xffa500) // Orange color for notifications
              .setTimestamp();

            const messageOptions = { embeds: [notificationEmbed] };
            
            // Add role ping if configured
            if (activeGame.pingRoleId) {
              messageOptions.content = `<@&${activeGame.pingRoleId}> **Task submission pending review!**`;
            }

            await announcementChannel.send(messageOptions);
          }
        } catch (error) {
          console.log('Could not send notification to announcement channel:', error);
        }
      }

      // Confirm to user
      await interaction.editReply({
        content: `✅ **Task submission sent for review!**\n\n📋 **Details:**\n• **Team:** ${activeTeam.teamName}\n• **Position:** Tile ${activeTeam.currentPosition}\n• **Screenshot:** Attached\n• **Description:** ${description}\n• **Review Location:** ${submitChannel}\n\n⏳ Waiting for moderator approval to continue rolling...`,
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
