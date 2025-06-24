import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle } from 'discord.js';
import Game from '../models/Game.js';
import Application from '../models/Application.js';
import { hasModeratorPermissions } from './moderatorHelpers.js';

// Handle game selection for accepting applications
export async function handleSelectGameAccept(interaction) {
  if (!(await hasModeratorPermissions(interaction))) {
    return await interaction.editReply({ 
      content: '❌ You need Administrator permissions or the designated moderator role to manage applications.'
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
  if (!(await hasModeratorPermissions(interaction))) {
    return await interaction.editReply({ 
      content: '❌ You need Administrator permissions or the designated moderator role to manage applications.'
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
  if (!(await hasModeratorPermissions(interaction))) {
    return await interaction.editReply({ 
      content: '❌ You need Administrator permissions or the designated moderator role to manage applications.'
    });
  }

  // Handle multiple selections from the new command format
  const selectedValues = interaction.values;
  if (!selectedValues || selectedValues.length === 0) {
    return await interaction.editReply({ 
      content: '❌ No applications selected.'
    });
  }

  try {
    // Process all selected applications
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const value of selectedValues) {
      const applicationObjectId = value.replace('accept_app_', '');
      
      try {
        // Get the application details using MongoDB _id
        const application = await Application.findById(applicationObjectId);
        if (!application) {
          errors.push(`Application not found: ${applicationObjectId}`);
          errorCount++;
          continue;
        }

        if (application.status !== 'pending') {
          errors.push(`Application for ${application.displayName || application.username} has already been ${application.status}`);
          errorCount++;
          continue;
        }

        // Update application status
        application.status = 'accepted';
        application.processedAt = new Date();
        await application.save();

        // Send DM to the user
        try {
          const user = await interaction.client.users.fetch(application.userId);
          if (user) {
            const dmEmbed = new EmbedBuilder()
              .setTitle('🎉 Application Accepted!')
              .setDescription(`Your application has been accepted!`)
              .addFields(
                { name: '🎮 Game', value: 'Snakes & Ladders Game', inline: true },
                { name: '✅ Status', value: 'Accepted', inline: true }
              )
              .setColor('#00ff00')
              .setTimestamp();

            await user.send({ embeds: [dmEmbed] });
          }
        } catch (dmError) {
          console.error('Failed to send DM:', dmError);
          // Continue processing even if DM fails
        }

        successCount++;

      } catch (appError) {
        console.error('Error processing application:', appError);
        errors.push(`Failed to process application: ${applicationObjectId}`);
        errorCount++;
      }
    }

    // Create response message
    let responseMessage = '';
    if (successCount > 0) {
      responseMessage += `✅ Successfully accepted ${successCount} application${successCount > 1 ? 's' : ''}.\n`;
    }
    if (errorCount > 0) {
      responseMessage += `❌ Failed to process ${errorCount} application${errorCount > 1 ? 's' : ''}:\n`;
      errors.slice(0, 5).forEach(error => responseMessage += `• ${error}\n`);
      if (errors.length > 5) {
        responseMessage += `• ... and ${errors.length - 5} more errors\n`;
      }
    }

    await interaction.editReply({ 
      content: responseMessage || '✅ All applications processed successfully!'
    });

  } catch (error) {
    console.error('Error handling participant acceptance:', error);
    await interaction.editReply({ 
      content: '❌ Failed to process applications. Please try again later.'
    });
  }
}

// Handle participant selection for decline
export async function handleSelectParticipantDecline(interaction) {
  if (!(await hasModeratorPermissions(interaction))) {
    return await interaction.editReply({ 
      content: '❌ You need Administrator permissions or the designated moderator role to manage applications.'
    });
  }

  // Handle multiple selections from the new command format
  const selectedValues = interaction.values;
  if (!selectedValues || selectedValues.length === 0) {
    return await interaction.editReply({ 
      content: '❌ No applications selected.'
    });
  }

  try {
    // Process all selected applications
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const value of selectedValues) {
      const applicationObjectId = value.replace('decline_app_', '');
      
      try {
        // Get the application details using MongoDB _id
        const application = await Application.findById(applicationObjectId);
        if (!application) {
          errors.push(`Application not found: ${applicationObjectId}`);
          errorCount++;
          continue;
        }

        if (application.status !== 'pending') {
          errors.push(`Application for ${application.displayName || application.username} has already been ${application.status}`);
          errorCount++;
          continue;
        }

        // Update application status
        application.status = 'declined';
        application.processedAt = new Date();
        await application.save();

        // Send DM to the user
        try {
          const user = await interaction.client.users.fetch(application.userId);
          if (user) {
            const dmEmbed = new EmbedBuilder()
              .setTitle('📝 Application Update')
              .setDescription(`Your application has been declined.`)
              .addFields(
                { name: '🎮 Game', value: 'Snakes & Ladders Game', inline: true },
                { name: '❌ Status', value: 'Declined', inline: true }
              )
              .setColor('#ff4444')
              .setTimestamp();

            await user.send({ embeds: [dmEmbed] });
          }
        } catch (dmError) {
          console.error('Failed to send DM:', dmError);
          // Continue processing even if DM fails
        }

        successCount++;

      } catch (appError) {
        console.error('Error processing application:', appError);
        errors.push(`Failed to process application: ${applicationObjectId}`);
        errorCount++;
      }
    }

    // Create response message
    let responseMessage = '';
    if (successCount > 0) {
      responseMessage += `✅ Successfully declined ${successCount} application${successCount > 1 ? 's' : ''}.\n`;
    }
    if (errorCount > 0) {
      responseMessage += `❌ Failed to process ${errorCount} application${errorCount > 1 ? 's' : ''}:\n`;
      errors.slice(0, 5).forEach(error => responseMessage += `• ${error}\n`);
      if (errors.length > 5) {
        responseMessage += `• ... and ${errors.length - 5} more errors\n`;
      }
    }

    await interaction.editReply({ 
      content: responseMessage || '✅ All applications processed successfully!'
    });

  } catch (error) {
    console.error('Error handling participant decline:', error);
    await interaction.editReply({ 
      content: '❌ Failed to process applications. Please try again later.'
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

// Handle application selection for accepting (single game mode)
export async function handleSelectApplicationAccept(interaction) {
  if (!(await hasModeratorPermissions(interaction))) {
    return await interaction.editReply({ 
      content: '❌ You need Administrator permissions or the designated moderator role to manage applications.'
    });
  }

  try {
    const selectedApplicationIds = interaction.values.map(value => value.replace('accept_app_', ''));
    const acceptedApplications = [];
    
    for (const appId of selectedApplicationIds) {
      // Find and update the application
      const application = await Application.findById(appId);
      if (!application) {
        console.error(`Application with ID ${appId} not found`);
        continue;
      }

      // Update application status
      application.status = 'accepted';
      application.reviewedAt = new Date();
      application.reviewedBy = interaction.user.id;
      await application.save();

      acceptedApplications.push(application);

      // Send DM to accepted participant
      try {
        const user = await interaction.client.users.fetch(application.userId);
        if (user) {
          const game = await Game.findOne({ gameId: application.gameId });
          const dmEmbed = new EmbedBuilder()
            .setTitle('🎉 Application Accepted!')
            .setDescription(`Your application for **${game.name}** has been accepted!`)
            .addFields(
              { name: '🎮 Game', value: game.name, inline: true },
              { name: '📅 Accepted', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
              { name: '📋 Next Steps', value: 'Wait for the moderators to start the game. You\'ll be notified when teams are created!' }
            )
            .setColor('#00ff00')
            .setTimestamp();

          await user.send({ embeds: [dmEmbed] });
        }
      } catch (dmError) {
        console.error('Failed to send DM to accepted participant:', dmError);
      }
    }

    // Create confirmation embed
    const confirmEmbed = new EmbedBuilder()
      .setTitle('✅ Applications Accepted')
      .setDescription(`Successfully accepted ${acceptedApplications.length} application${acceptedApplications.length === 1 ? '' : 's'}!`)
      .addFields({
        name: '👥 Accepted Participants',
        value: acceptedApplications.map(app => 
          `• ${app.displayName || app.username} (${app.username})`
        ).join('\n') || 'None'
      })
      .setColor('#00ff00')
      .setTimestamp();

    await interaction.editReply({ embeds: [confirmEmbed], components: [] });

    console.log(`Applications accepted by ${interaction.user.username}:`, acceptedApplications.map(app => app.username));

  } catch (error) {
    console.error('Error accepting applications:', error);
    await interaction.editReply({ 
      content: '❌ Failed to accept applications. Please try again later.',
      components: []
    });
  }
}

// Handle application selection for declining (single game mode)
export async function handleSelectApplicationDecline(interaction) {
  if (!(await hasModeratorPermissions(interaction))) {
    return await interaction.editReply({ 
      content: '❌ You need Administrator permissions or the designated moderator role to manage applications.'
    });
  }

  try {
    const selectedApplicationIds = interaction.values.map(value => value.replace('decline_app_', ''));
    const declinedApplications = [];
    
    for (const appId of selectedApplicationIds) {
      // Find and update the application
      const application = await Application.findById(appId);
      if (!application) {
        console.error(`Application with ID ${appId} not found`);
        continue;
      }

      // Update application status
      application.status = 'declined';
      application.reviewedAt = new Date();
      application.reviewedBy = interaction.user.id;
      await application.save();

      declinedApplications.push(application);

      // Send DM to declined participant
      try {
        const user = await interaction.client.users.fetch(application.userId);
        if (user) {
          const game = await Game.findOne({ gameId: application.gameId });
          const dmEmbed = new EmbedBuilder()
            .setTitle('❌ Application Declined')
            .setDescription(`Your application for **${game.name}** has been declined.`)
            .addFields(
              { name: '🎮 Game', value: game.name, inline: true },
              { name: '📅 Reviewed', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
              { name: '💭 Note', value: 'You can apply for future games when they become available.' }
            )
            .setColor('#ff0000')
            .setTimestamp();

          await user.send({ embeds: [dmEmbed] });
        }
      } catch (dmError) {
        console.error('Failed to send DM to declined participant:', dmError);
      }
    }

    // Create confirmation embed
    const confirmEmbed = new EmbedBuilder()
      .setTitle('❌ Applications Declined')
      .setDescription(`Successfully declined ${declinedApplications.length} application${declinedApplications.length === 1 ? '' : 's'}.`)
      .addFields({
        name: '👥 Declined Participants',
        value: declinedApplications.map(app => 
          `• ${app.displayName || app.username} (${app.username})`
        ).join('\n') || 'None'
      })
      .setColor('#ff0000')
      .setTimestamp();

    await interaction.editReply({ embeds: [confirmEmbed], components: [] });

    console.log(`Applications declined by ${interaction.user.username}:`, declinedApplications.map(app => app.username));

  } catch (error) {
    console.error('Error declining applications:', error);
    await interaction.editReply({ 
      content: '❌ Failed to decline applications. Please try again later.',
      components: []
    });
  }
}
