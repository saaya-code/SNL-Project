import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } from 'discord.js';
import { v4 as uuidv4 } from 'uuid';
import Game from '../models/Game.js';
import Application from '../models/Application.js';

export async function handleJoinGame(interaction) {
  const gameId = interaction.customId.split('_').pop();
  
  try {
    // Check if game exists and is in registration status
    const game = await Game.findOne({ gameId: gameId });
    if (!game) {
      return await interaction.reply({ 
        content: '❌ Game not found.',
        flags: 64 
      });
    }

    if (game.status !== 'registration') {
      return await interaction.reply({ 
        content: '❌ Registration is not currently open for this game.',
        flags: 64 
      });
    }

    // Check if application deadline has passed
    if (game.applicationDeadline && new Date() > game.applicationDeadline) {
      return await interaction.reply({ 
        content: '❌ The application deadline for this game has passed.',
        flags: 64 
      });
    }

    // Check if user already applied
    const existingApplication = await Application.findOne({ 
      gameId: gameId, 
      userId: interaction.user.id 
    });

    if (existingApplication) {
      return await interaction.reply({ 
        content: `❌ You have already applied for this game. Your application status: **${existingApplication.status}**\n\nYour application channel: <#${existingApplication.channelId}>`,
        flags: 64 
      });
    }

    await interaction.deferReply({ ephemeral: true });

    // Find or create the Applications category
    let category = interaction.guild.channels.cache.find(
      channel => channel.type === ChannelType.GuildCategory && 
      channel.name.toLowerCase() === 'snl applications'
    );

    if (!category) {
      category = await interaction.guild.channels.create({
        name: 'SNL Applications',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: interaction.guild.roles.everyone,
            deny: [PermissionFlagsBits.ViewChannel],
          },
        ],
      });
    }

    // Get moderator role (you might want to make this configurable)
    const moderatorRole = interaction.guild.roles.cache.find(
      role => role.name.toLowerCase().includes('moderator') || 
             role.name.toLowerCase().includes('admin') ||
             role.permissions.has(PermissionFlagsBits.Administrator)
    );

    // Create private application channel
    const applicationChannel = await interaction.guild.channels.create({
      name: `${game.name.toLowerCase().replace(/\s+/g, '-')}-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        {
          id: interaction.guild.roles.everyone,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ],
        },
        ...(moderatorRole ? [{
          id: moderatorRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ],
        }] : [])
      ],
    });

    // Create application record
    const applicationId = uuidv4();
    const application = new Application({
      applicationId: applicationId,
      gameId: gameId,
      userId: interaction.user.id,
      username: interaction.user.username,
      displayName: interaction.user.displayName || interaction.user.username,
      avatarUrl: interaction.user.displayAvatarURL({ dynamic: true, size: 256 }),
      channelId: applicationChannel.id,
      status: 'pending'
    });

    await application.save();

    // Create welcome message in the application channel
    const welcomeEmbed = new EmbedBuilder()
      .setTitle(`🎮 Application for "${game.name}"`)
      .setDescription(`Welcome ${interaction.user}! Your application for **${game.name}** has been submitted.`)
      .addFields(
        { name: '📋 Application Details', value: `**Game:** ${game.name}\n**Game ID:** ${gameId}\n**Applied:** <t:${Math.floor(Date.now() / 1000)}:F>\n**Status:** Pending Review` },
        { name: '📝 Next Steps', value: '• Moderators will review your application\n• You may be asked additional questions\n• Please be patient and wait for a response\n• Do not spam or ping moderators' },
        { name: '⏰ Application Deadline', value: game.applicationDeadline ? `<t:${Math.floor(game.applicationDeadline.getTime() / 1000)}:F>` : 'No deadline set' }
      )
      .setColor('#0099ff')
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Application ID: ${applicationId}` })
      .setTimestamp();

    // Create action buttons for moderators
    const moderatorRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`approve_application_${applicationId}`)
          .setLabel('✅ Approve')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`reject_application_${applicationId}`)
          .setLabel('❌ Reject')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`request_info_${applicationId}`)
          .setLabel('💬 Request Info')
          .setStyle(ButtonStyle.Secondary)
      );

    await applicationChannel.send({ 
      embeds: [welcomeEmbed], 
      components: [moderatorRow] 
    });

    // Send confirmation to user
    await interaction.editReply({
      content: `✅ **Application Submitted Successfully!**\n\nYour application for **${game.name}** has been created.\n\n**Your Application Channel:** ${applicationChannel}\n\nModerators will review your application and get back to you soon. Please check the channel for updates!`
    });

    // Log to console
    console.log(`New application: ${interaction.user.username} applied for game "${game.name}" (${gameId})`);

  } catch (error) {
    console.error('Error creating application:', error);
    
    try {
      if (interaction.deferred) {
        await interaction.editReply({ 
          content: '❌ Failed to create application. Please try again later.' 
        });
      } else {
        await interaction.reply({ 
          content: '❌ Failed to create application. Please try again later.',
          flags: 64 
        });
      }
    } catch (followUpError) {
      console.error('Failed to send error response:', followUpError);
    }
  }
}

export async function handleApproveApplication(interaction) {
  const applicationId = interaction.customId.split('_').pop();
  
  // Check if user has moderator permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && 
      !interaction.member.roles.cache.some(role => 
        role.name.toLowerCase().includes('moderator') || 
        role.name.toLowerCase().includes('admin')
      )) {
    return await interaction.editReply({ 
      content: '❌ You do not have permission to approve applications.'
    });
  }

  try {
    const application = await Application.findOne({ applicationId: applicationId });
    if (!application) {
      return await interaction.editReply({ 
        content: '❌ Application not found.'
      });
    }

    if (application.status !== 'pending') {
      return await interaction.editReply({ 
        content: `❌ Application has already been ${application.status}.`
      });
    }

    // Update application status
    application.status = 'accepted';
    application.reviewedAt = new Date();
    application.reviewedBy = interaction.user.id;
    await application.save();

    // Create approval embed
    const approvalEmbed = new EmbedBuilder()
      .setTitle('🎉 Application Approved!')
      .setDescription(`Congratulations! Your application for **${(await Game.findOne({ gameId: application.gameId }))?.name || 'the game'}** has been **approved**!`)
      .addFields(
        { name: '✅ Status', value: 'Accepted', inline: true },
        { name: '👤 Reviewed By', value: `${interaction.user}`, inline: true },
        { name: '⏰ Reviewed At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        { name: '📋 Next Steps', value: '• You will be added to a team\n• Wait for further instructions\n• Game details will be shared when ready' }
      )
      .setColor('#00ff00')
      .setTimestamp();

    await interaction.reply({ embeds: [approvalEmbed] });

    console.log(`Application approved: ${application.username} for game ${application.gameId} by ${interaction.user.username}`);

  } catch (error) {
    console.error('Error approving application:', error);
    await interaction.editReply({ 
      content: '❌ Failed to approve application. Please try again later.'
    });
  }
}

export async function handleRejectApplication(interaction) {
  const applicationId = interaction.customId.split('_').pop();
  
  // Check if user has moderator permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && 
      !interaction.member.roles.cache.some(role => 
        role.name.toLowerCase().includes('moderator') || 
        role.name.toLowerCase().includes('admin')
      )) {
    return await interaction.editReply({ 
      content: '❌ You do not have permission to reject applications.'
    });
  }

  try {
    const application = await Application.findOne({ applicationId: applicationId });
    if (!application) {
      return await interaction.editReply({ 
        content: '❌ Application not found.'
      });
    }

    if (application.status !== 'pending') {
      return await interaction.editReply({ 
        content: `❌ Application has already been ${application.status}.`
      });
    }

    // Update application status
    application.status = 'rejected';
    application.reviewedAt = new Date();
    application.reviewedBy = interaction.user.id;
    await application.save();

    // Create rejection embed
    const rejectionEmbed = new EmbedBuilder()
      .setTitle('❌ Application Rejected')
      .setDescription(`Your application for **${(await Game.findOne({ gameId: application.gameId }))?.name || 'the game'}** has been **rejected**.`)
      .addFields(
        { name: '❌ Status', value: 'Rejected', inline: true },
        { name: '👤 Reviewed By', value: `${interaction.user}`, inline: true },
        { name: '⏰ Reviewed At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        { name: '💭 Note', value: 'You may ask the moderators for feedback or apply for future games.' }
      )
      .setColor('#ff0000')
      .setTimestamp();

    await interaction.reply({ embeds: [rejectionEmbed] });

    console.log(`Application rejected: ${application.username} for game ${application.gameId} by ${interaction.user.username}`);

  } catch (error) {
    console.error('Error rejecting application:', error);
    await interaction.editReply({ 
      content: '❌ Failed to reject application. Please try again later.'
    });
  }
}

export async function handleRequestInfo(interaction) {
  const applicationId = interaction.customId.split('_').pop();
   // Check if user has moderator permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) &&
      !interaction.member.roles.cache.some(role => 
        role.name.toLowerCase().includes('moderator') || 
        role.name.toLowerCase().includes('admin')
      )) {
    return await interaction.editReply({ 
      content: '❌ You do not have permission to request information.'
    });
  }

  const infoEmbed = new EmbedBuilder()
    .setTitle('💬 Additional Information Requested')
    .setDescription('A moderator would like additional information about your application. Please provide any relevant details or answer any questions they may have.')
    .addFields(
      { name: '👤 Requested By', value: `${interaction.user}`, inline: true },
      { name: '⏰ Requested At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
    )
    .setColor('#ffaa00')
    .setTimestamp();

  await interaction.editReply({ embeds: [infoEmbed] });
}
