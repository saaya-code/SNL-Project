import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle } from 'discord.js';
import Game from '../models/Game.js';
import Application from '../models/Application.js';

// Handle game selection for accepting applications
export async function handleSelectGameAccept(interaction) {
  if (!interaction.member.permissions.has('Administrator')) {
    return await interaction.editReply({ 
      content: '❌ You need Administrator permissions to manage applications.'
    });
  }

  const gameId = interaction.values[0].replace('accept_game_', '');
  
  try {
    // Get the game details
    const game = await Game.findOne({ gameId: gameId });
    if (!game) {
      return await interaction.editReply({ 
        content: '❌ Game not found.'
      });
    }

    // Get pending applications for this game
    const applications = await Application.find({ 
      gameId: gameId, 
      status: 'pending' 
    }).sort({ createdAt: 1 });

    if (applications.length === 0) {
      return await interaction.editReply({ 
        content: `📭 No pending applications found for "${game.name}".`
      });
    }

    // Create dropdown menu for participant selection
    const participantOptions = applications.map(app => ({
      label: app.displayName || app.username,
      description: `Applied ${new Date(app.createdAt).toLocaleDateString()} | User: ${app.username}`,
      value: `accept_user_${app.applicationId}`
    })).slice(0, 25); // Discord limit

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_participant_accept')
      .setPlaceholder('Select a participant to accept')
      .addOptions(participantOptions);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
      .setTitle(`✅ Accept Applications - ${game.name}`)
      .setDescription(`Select a participant to accept their application.`)
      .addFields(
        { name: '🎮 Game', value: game.name, inline: true },
        { name: '👥 Max Team Size', value: game.maxTeamSize?.toString() || '1', inline: true },
        { name: '📝 Pending Applications', value: applications.length.toString(), inline: true },
        { name: '⏰ Application Deadline', value: game.applicationDeadline ? `<t:${Math.floor(game.applicationDeadline.getTime() / 1000)}:F>` : 'No deadline set' }
      )
      .setColor('#00ff00')
      .setTimestamp();

    await interaction.editReply({ 
      embeds: [embed], 
      components: [row] 
    });

  } catch (error) {
    console.error('Error loading game applications:', error);
    await interaction.editReply({ 
      content: '❌ Failed to load applications. Please try again later.'
    });
  }
}

// Handle game selection for declining applications
export async function handleSelectGameDecline(interaction) {
  if (!interaction.member.permissions.has('Administrator')) {
    return await interaction.editReply({ 
      content: '❌ You need Administrator permissions to manage applications.'
    });
  }

  const gameId = interaction.values[0].replace('decline_game_', '');
  
  try {
    // Get the game details
    const game = await Game.findOne({ gameId: gameId });
    if (!game) {
      return await interaction.editReply({ 
        content: '❌ Game not found.'
      });
    }

    // Get pending applications for this game
    const applications = await Application.find({ 
      gameId: gameId, 
      status: 'pending' 
    }).sort({ createdAt: 1 });

    if (applications.length === 0) {
      return await interaction.editReply({ 
        content: `📭 No pending applications found for "${game.name}".`
      });
    }

    // Create dropdown menu for participant selection
    const participantOptions = applications.map(app => ({
      label: app.displayName || app.username,
      description: `Applied ${new Date(app.createdAt).toLocaleDateString()} | User: ${app.username}`,
      value: `decline_user_${app.applicationId}`
    })).slice(0, 25); // Discord limit

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_participant_decline')
      .setPlaceholder('Select a participant to decline')
      .addOptions(participantOptions);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
      .setTitle(`❌ Decline Applications - ${game.name}`)
      .setDescription(`Select a participant to decline their application.`)
      .addFields(
        { name: '🎮 Game', value: game.name, inline: true },
        { name: '👥 Max Team Size', value: game.maxTeamSize?.toString() || '1', inline: true },
        { name: '📝 Pending Applications', value: applications.length.toString(), inline: true },
        { name: '⏰ Application Deadline', value: game.applicationDeadline ? `<t:${Math.floor(game.applicationDeadline.getTime() / 1000)}:F>` : 'No deadline set' }
      )
      .setColor('#ff0000')
      .setTimestamp();

    await interaction.editReply({ 
      embeds: [embed], 
      components: [row] 
    });

  } catch (error) {
    console.error('Error loading game applications:', error);
    await interaction.editReply({ 
      content: '❌ Failed to load applications. Please try again later.'
    });
  }
}

// Handle participant selection for acceptance
export async function handleSelectParticipantAccept(interaction) {
  if (!interaction.member.permissions.has('Administrator')) {
    return await interaction.editReply({ 
      content: '❌ You need Administrator permissions to manage applications.'
    });
  }

  const applicationId = interaction.values[0].replace('accept_user_', '');
  
  try {
    // Get the application details
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

    // Get the game details
    const game = await Game.findOne({ gameId: application.gameId });
    if (!game) {
      return await interaction.editReply({ 
        content: '❌ Game not found.'
      });
    }

    // Create modal for acceptance confirmation
    const modal = new ModalBuilder()
      .setCustomId(`confirm_accept_${applicationId}`)
      .setTitle('Accept Application');

    const reasonInput = new TextInputBuilder()
      .setCustomId('acceptance_message')
      .setLabel('Acceptance Message (Optional)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Welcome to the game! We\'re excited to have you...')
      .setRequired(false)
      .setMaxLength(1000);

    const row = new ActionRowBuilder().addComponents(reasonInput);
    modal.addComponents(row);

    await interaction.showModal(modal);

  } catch (error) {
    console.error('Error handling participant selection:', error);
    await interaction.editReply({ 
      content: '❌ Failed to process selection. Please try again later.'
    });
  }
}

// Handle participant selection for decline
export async function handleSelectParticipantDecline(interaction) {
  if (!interaction.member.permissions.has('Administrator')) {
    return await interaction.editReply({ 
      content: '❌ You need Administrator permissions to manage applications.'
    });
  }

  const applicationId = interaction.values[0].replace('decline_user_', '');
  
  try {
    // Get the application details
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

    // Get the game details
    const game = await Game.findOne({ gameId: application.gameId });
    if (!game) {
      return await interaction.editReply({ 
        content: '❌ Game not found.'
      });
    }

    // Create modal for decline confirmation
    const modal = new ModalBuilder()
      .setCustomId(`confirm_decline_${applicationId}`)
      .setTitle('Decline Application');

    const reasonInput = new TextInputBuilder()
      .setCustomId('decline_reason')
      .setLabel('Decline Reason (Optional)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Thank you for your interest, however...')
      .setRequired(false)
      .setMaxLength(1000);

    const row = new ActionRowBuilder().addComponents(reasonInput);
    modal.addComponents(row);

    await interaction.showModal(modal);

  } catch (error) {
    console.error('Error handling participant selection:', error);
    await interaction.editReply({ 
      content: '❌ Failed to process selection. Please try again later.'
    });
  }
}

// Handle acceptance confirmation modal
export async function handleConfirmAccept(interaction) {
  if (!interaction.member.permissions.has('Administrator')) {
    return await interaction.editReply({ 
      content: '❌ You need Administrator permissions to manage applications.'
    });
  }

  const applicationId = interaction.customId.replace('confirm_accept_', '');
  const acceptanceMessage = interaction.fields.getTextInputValue('acceptance_message');
  
  try {
    // Get the application
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

    // Get the game
    const game = await Game.findOne({ gameId: application.gameId });
    if (!game) {
      return await interaction.editReply({ 
        content: '❌ Game not found.'
      });
    }

    // Update application status
    application.status = 'accepted';
    application.reviewedAt = new Date();
    application.reviewedBy = interaction.user.id;
    await application.save();

    // Send acceptance message to the application channel
    try {
      const channel = await interaction.client.channels.fetch(application.channelId);
      if (channel) {
        const acceptanceEmbed = new EmbedBuilder()
          .setTitle('🎉 Application Accepted!')
          .setDescription(`Congratulations! Your application for **${game.name}** has been **accepted**!`)
          .addFields(
            { name: '✅ Status', value: 'Accepted', inline: true },
            { name: '👤 Reviewed By', value: `${interaction.user}`, inline: true },
            { name: '⏰ Reviewed At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
          )
          .setColor('#00ff00')
          .setTimestamp();

        if (acceptanceMessage.trim()) {
          acceptanceEmbed.addFields({ 
            name: '💬 Message from Moderator', 
            value: acceptanceMessage 
          });
        }

        await channel.send({ embeds: [acceptanceEmbed] });
      }
    } catch (channelError) {
      console.error('Error sending message to application channel:', channelError);
    }

    // Send confirmation to admin
    const confirmEmbed = new EmbedBuilder()
      .setTitle('✅ Application Accepted')
      .setDescription(`Successfully accepted **${application.displayName || application.username}**'s application for **${game.name}**.`)
      .addFields(
        { name: '👤 Participant', value: `${application.displayName || application.username} (${application.username})`, inline: true },
        { name: '🎮 Game', value: game.name, inline: true },
        { name: '📅 Applied', value: `<t:${Math.floor(application.createdAt.getTime() / 1000)}:R>`, inline: true }
      )
      .setColor('#00ff00')
      .setTimestamp();

    await interaction.editReply({ embeds: [confirmEmbed], components: [] });

    console.log(`Application accepted: ${application.username} for game "${game.name}" by ${interaction.user.username}`);

  } catch (error) {
    console.error('Error accepting application:', error);
    await interaction.editReply({ 
      content: '❌ Failed to accept application. Please try again later.',
      components: []
    });
  }
}

// Handle decline confirmation modal
export async function handleConfirmDecline(interaction) {
  if (!interaction.member.permissions.has('Administrator')) {
    return await interaction.editReply({ 
      content: '❌ You need Administrator permissions to manage applications.'
    });
  }

  const applicationId = interaction.customId.replace('confirm_decline_', '');
  const declineReason = interaction.fields.getTextInputValue('decline_reason');
  
  try {
    // Get the application
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

    // Get the game
    const game = await Game.findOne({ gameId: application.gameId });
    if (!game) {
      return await interaction.editReply({ 
        content: '❌ Game not found.'
      });
    }

    // Update application status
    application.status = 'rejected';
    application.reviewedAt = new Date();
    application.reviewedBy = interaction.user.id;
    await application.save();

    // Send decline message to the application channel
    try {
      const channel = await interaction.client.channels.fetch(application.channelId);
      if (channel) {
        const declineEmbed = new EmbedBuilder()
          .setTitle('❌ Application Declined')
          .setDescription(`Your application for **${game.name}** has been **declined**.`)
          .addFields(
            { name: '❌ Status', value: 'Declined', inline: true },
            { name: '👤 Reviewed By', value: `${interaction.user}`, inline: true },
            { name: '⏰ Reviewed At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
          )
          .setColor('#ff0000')
          .setTimestamp();

        if (declineReason.trim()) {
          declineEmbed.addFields({ 
            name: '💬 Reason', 
            value: declineReason 
          });
        }

        await channel.send({ embeds: [declineEmbed] });
      }
    } catch (channelError) {
      console.error('Error sending message to application channel:', channelError);
    }

    // Send confirmation to admin
    const confirmEmbed = new EmbedBuilder()
      .setTitle('❌ Application Declined')
      .setDescription(`Successfully declined **${application.displayName || application.username}**'s application for **${game.name}**.`)
      .addFields(
        { name: '👤 Participant', value: `${application.displayName || application.username} (${application.username})`, inline: true },
        { name: '🎮 Game', value: game.name, inline: true },
        { name: '📅 Applied', value: `<t:${Math.floor(application.createdAt.getTime() / 1000)}:R>`, inline: true }
      )
      .setColor('#ff0000')
      .setTimestamp();

    await interaction.editReply({ embeds: [confirmEmbed], components: [] });

    console.log(`Application declined: ${application.username} for game "${game.name}" by ${interaction.user.username}`);

  } catch (error) {
    console.error('Error declining application:', error);
    await interaction.editReply({ 
      content: '❌ Failed to decline application. Please try again later.',
      components: []
    });
  }
}
