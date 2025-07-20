import { EmbedBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import Game from '../models/Game.js';
import Team from '../models/Team.js';
import Application from '../models/Application.js';

// Helper function to shuffle array
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Helper function to generate unique team ID
function generateTeamId() {
  return Math.random().toString(36).substr(2, 9);
}

// Function to start game and create teams only (no channels) - used by snlStartGame.js
export async function startGameWithParticipants(interaction, gameId) {
  try {
    const game = await Game.findOne({ gameId: gameId });
    if (!game) {
      return await interaction.editReply({ 
        content: '❌ Game not found.'
      });
    }

    if (game.status !== 'registration') {
      return await interaction.editReply({ 
        content: `❌ Game "${game.name}" is not in registration status. Current status: ${game.status}`
      });
    }

    const acceptedApplications = await Application.find({ 
      gameId: gameId, 
      status: 'accepted' 
    });

    if (acceptedApplications.length === 0) {
      return await interaction.editReply({ 
        content: `❌ No accepted participants found for "${game.name}".`
      });
    }

    // Check minimum participants
    const isDevelopmentMode = process.env.DEV_MODE === 'true';
    const minParticipants = isDevelopmentMode ? 1 : Math.max(2, game.maxTeamSize || 2);
    
    if (acceptedApplications.length < minParticipants) {
      const devModeNote = isDevelopmentMode ? ' (Development mode: minimum 1 participant)' : '';
      return await interaction.editReply({ 
        content: `❌ Not enough participants to start the game. Need at least ${minParticipants}, but only ${acceptedApplications.length} accepted.${devModeNote}`
      });
    }

    // Calculate teams
    const maxTeamSize = game.maxTeamSize || 4;
    const participantCount = acceptedApplications.length;
    let teamCount;
    
    if (isDevelopmentMode && participantCount === 1) {
      teamCount = 1;
    } else {
      teamCount = Math.ceil(participantCount / maxTeamSize);
      if (teamCount === 1 && participantCount >= 2) {
        teamCount = 2;
      }
    }

    // Shuffle and distribute participants
    const shuffledParticipants = shuffleArray(acceptedApplications);
    const teams = [];
    for (let i = 0; i < teamCount; i++) {
      teams.push([]);
    }

    shuffledParticipants.forEach((participant, index) => {
      const teamIndex = index % teamCount;
      teams[teamIndex].push(participant);
    });

    // Create team data only (no channels)
    const createdTeams = [];

    for (let i = 0; i < teams.length; i++) {
      const teamMembers = teams[i];
      if (teamMembers.length === 0) continue;

      const teamName = `Team ${String.fromCharCode(65 + i)}`; // Team A, Team B, etc.
      const teamId = generateTeamId();

      // Assign leader and co-leader
      const leader = teamMembers[0];
      const coLeader = teamMembers.length > 1 ? teamMembers[1] : null;

      // Create team object without channel
      const teamData = new Team({
        teamId: teamId,
        gameId: gameId,
        teamName: teamName,
        members: teamMembers.map(member => ({
          userId: member.userId,
          username: member.username,
          displayName: member.displayName
        })),
        leader: {
          userId: leader.userId,
          username: leader.username,
          displayName: leader.displayName
        },
        coLeader: coLeader ? {
          userId: coLeader.userId,
          username: coLeader.username,
          displayName: coLeader.displayName
        } : null,
        channelId: null, // No channel yet
        currentPosition: 0, // Teams start from tile 0
        canRoll: false // Cannot roll until officially started
      });

      await teamData.save();
      createdTeams.push(teamData);
    }

    // Update game status to active but not officially started
    game.status = 'active';
    game.isOfficiallyStarted = false;
    game.channelsSetup = false;
    game.startedAt = new Date();
    await game.save();

    // Create summary embed
    const summaryEmbed = new EmbedBuilder()
      .setTitle(`🎮 ${game.name} - Teams Created!`)
      .setDescription(`Teams have been created but channels are not set up yet.`)
      .addFields(
        { name: '👥 Total Participants', value: acceptedApplications.length.toString(), inline: true },
        { name: '🏆 Teams Created', value: createdTeams.length.toString(), inline: true },
        { name: '📅 Created At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        { name: '📋 Next Step', value: 'Use `/snlsetup` to create team channels', inline: false },
        { name: '🏁 Teams', value: createdTeams.map(team => 
          `**${team.teamName}**: ${team.members.length} member${team.members.length === 1 ? '' : 's'}\n` +
          `Leader: ${team.leader.displayName}` +
          (team.coLeader ? `\nCo-Leader: ${team.coLeader.displayName}` : '')
        ).join('\n\n'), inline: false }
      )
      .setColor('#FFA500') // Orange to indicate incomplete setup
      .setTimestamp();

    await interaction.editReply({ embeds: [summaryEmbed] });

  } catch (error) {
    console.error('Error creating teams:', error);
    await interaction.editReply({ 
      content: '❌ Failed to create teams. Please try again later.'
    });
  }
}

// Function to setup channels for existing teams - used by snlSetup.js
export async function setupGameChannels(interaction, gameId, existingTeams = null) {
  try {
    const game = await Game.findOne({ gameId: gameId });
    if (!game) {
      return { success: false, error: 'Game not found' };
    }

    // Get teams - either passed in or fetch from database
    const teams = existingTeams || await Team.find({ gameId: gameId });
    
    if (teams.length === 0) {
      return { success: false, error: 'No teams found for this game' };
    }

    const guild = interaction.guild;

    // Find or create the Game Teams category
    let gameCategory = guild.channels.cache.find(
      channel => channel.type === ChannelType.GuildCategory && 
      channel.name.toLowerCase() === `${game.name.toLowerCase()} - teams`
    );

    if (!gameCategory) {
      gameCategory = await guild.channels.create({
        name: `${game.name} - Teams`,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
            deny: [PermissionFlagsBits.ViewChannel],
          },
        ],
      });
    }

    // Find or create SNL Announcements channel
    let announcementsChannel = guild.channels.cache.find(
      channel => channel.type === ChannelType.GuildText && 
      channel.name.toLowerCase() === 'snl-announcements'
    );

    if (!announcementsChannel) {
      announcementsChannel = await guild.channels.create({
        name: 'snl-announcements',
        type: ChannelType.GuildText,
        parent: gameCategory,
        topic: `Game announcements and updates for ${game.name}`,
        permissionOverwrites: [
          {
            id: guild.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
            deny: [PermissionFlagsBits.SendMessages],
          },
          // Allow moderators to post
          {
            id: interaction.member.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageMessages
            ],
          },
        ],
      });
    }

    // Store announcement channel ID in game for future reference
    game.announcementChannelId = announcementsChannel.id;
    await game.save();

    let totalParticipants = 0;
    let channelsCreated = 0;

    // Create channels for each team
    for (const team of teams) {
      // Calculate total participants including leader and co-leader
      let teamSize = 0;
      if (team.leader) teamSize++;
      if (team.coLeader) teamSize++;
      if (team.members && Array.isArray(team.members)) teamSize += team.members.length;
      totalParticipants += teamSize;

      // Skip if team already has a proper channel (not dashboard-team)
      if (team.channelId && 
          team.channelId !== 'dashboard-team' && 
          team.channelId !== 'dashboard-created') {
        continue;
      }

      // Collect all team member IDs (leader, co-leader, members)
      const allMemberIds = [];
      if (team.leader?.userId) allMemberIds.push(team.leader.userId);
      if (team.coLeader?.userId) allMemberIds.push(team.coLeader.userId);
      if (team.members && Array.isArray(team.members)) {
        team.members.forEach(member => {
          if (member.userId) allMemberIds.push(member.userId);
        });
      }

      // Create permission overwrites for valid guild members
      const permissionOverwrites = [
        {
          id: guild.roles.everyone,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        // Add permissions for moderators/admins
        {
          id: interaction.member.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages],
        }
      ];

      const invalidMembers = [];
      
      // Add permissions for each team member, checking if they're in the guild
      for (const userId of allMemberIds) {
        try {
          const guildMember = await guild.members.fetch(userId);
          if (guildMember) {
            permissionOverwrites.push({
              id: userId,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
            });
          }
        } catch (error) {
          console.log(`User ${userId} not found in guild ${guild.name}`);
          invalidMembers.push(userId);
        }
      }

      // Create private team channel
      const teamChannel = await guild.channels.create({
        name: `${game.name.toLowerCase().replace(/\s+/g, '-')}-${team.teamName.toLowerCase().replace(/\s+/g, '-')}`,
        type: ChannelType.GuildText,
        parent: gameCategory.id,
        permissionOverwrites: permissionOverwrites,
      });

      // Update team with channel ID
      team.channelId = teamChannel.id;
      await team.save();
      channelsCreated++;

      // Send welcome message to team channel
      const teamEmbed = new EmbedBuilder()
        .setTitle(`🎮 Welcome to ${team.teamName}!`)
        .setDescription(`Welcome to **${game.name}**! Your team channel has been created.`)
        .addFields(
          { name: '👑 Team Leader', value: team.leader ? `<@${team.leader.userId}> (${team.leader.displayName})` : 'Not assigned', inline: true },
          { name: '👥 Co-Leader', value: team.coLeader ? `<@${team.coLeader.userId}> (${team.coLeader.displayName})` : 'None', inline: true },
          { name: '📍 Starting Position', value: 'Tile 0', inline: true },
          { name: '👥 Team Members', value: allMemberIds.map(id => `<@${id}>`).join('\n') || 'No additional members' },
          { name: '🎲 Rolling', value: team.coLeader ? 'Only the leader and co-leader can use `/roll` to move the team!' : 'Only the team leader can use `/roll` to move the team!' },
          { name: '⚠️ Game Status', value: '**Game not officially started yet** - Wait for admin to use `/snlofficialstart`' },
          { name: '🎯 Objective', value: 'Work together to reach tile 100 first!' }
        )
        .setColor('#FFA500') // Orange to indicate not officially started
        .setTimestamp();

      await teamChannel.send({ embeds: [teamEmbed] });

      // If there are invalid members, send a notification
      if (invalidMembers.length > 0) {
        const invalidEmbed = new EmbedBuilder()
          .setTitle('⚠️ Team Member Access Issue')
          .setDescription('Some team members could not be given access to this channel because they are not in the Discord server.')
          .addFields({
            name: '👤 Affected Members',
            value: invalidMembers.map(id => `<@${id}>`).join('\n'),
            inline: false
          })
          .addFields({
            name: '📝 Next Steps',
            value: 'These members need to:\n• Join the Discord server\n• Contact an admin to be manually added to the team channel',
            inline: false
          })
          .setColor('#FFA500')
          .setTimestamp();

        await teamChannel.send({ embeds: [invalidEmbed] });
      }
    }

    // Update game to mark channels as set up
    game.channelsSetup = true;
    await game.save();

    // Send announcement about channels being set up
    if (game.announcementChannelId) {
      try {
        const channelSetupEmbed = new EmbedBuilder()
          .setTitle(`🛠️ ${game.name} - Channels Setup Complete!`)
          .setDescription(`Team channels have been created! **Game is not officially started yet.**`)
          .addFields(
            { name: '👥 Participants', value: totalParticipants.toString(), inline: true },
            { name: '🏆 Teams', value: teams.length.toString(), inline: true },
            { name: '📅 Channels Created', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
            { name: '🚫 Rolling Status', value: 'Teams **cannot roll yet**', inline: false },
            { name: '▶️ Next Step', value: 'Admin must use `/snlofficialstart` to allow rolling', inline: false },
            { name: '🎯 Objective', value: 'First team to reach tile 100 wins!' }
          )
          .setColor('#FFA500') // Orange color to indicate not fully started
          .setTimestamp();

        const messageOptions = { embeds: [channelSetupEmbed] };
        
        // Add role ping if configured
        if (game.pingRoleId) {
          messageOptions.content = `<@&${game.pingRoleId}>`;
        }

        await announcementsChannel.send(messageOptions);
      } catch (error) {
        console.error('Failed to send channel setup announcement:', error);
      }
    }

    return {
      success: true,
      teamsCreated: teams.length,
      totalParticipants: totalParticipants,
      announcementChannelId: announcementsChannel.id,
      channelsCreated: channelsCreated
    };

  } catch (error) {
    console.error('Error setting up game channels:', error);
    return { success: false, error: error.message };
  }
}

// Function to handle game selection for starting - used by index.js
export async function handleSelectGameToStart(interaction) {
  try {
    const selectedGameId = interaction.values[0];
    
    // Find the selected game
    const game = await Game.findOne({ gameId: selectedGameId });
    if (!game) {
      return await interaction.editReply({
        content: '❌ Selected game not found.',
        components: []
      });
    }

    // Check if game is in correct status for starting
    if (game.status !== 'registration') {
      return await interaction.editReply({
        content: `❌ Game "${game.name}" cannot be started. Current status: ${game.status}. Only games in 'registration' status can be started.`,
        components: []
      });
    }

    // Check if there are accepted applications
    const acceptedApplications = await Application.find({ 
      gameId: selectedGameId, 
      status: 'accepted' 
    });

    if (acceptedApplications.length === 0) {
      return await interaction.editReply({
        content: `❌ No accepted participants found for "${game.name}". Please ensure applications are accepted before starting the game.`,
        components: []
      });
    }

    // Start the game with participants
    const result = await startGameWithParticipants(interaction, selectedGameId);
    
    if (result.success) {
      await interaction.editReply({
        content: `✅ **Game "${game.name}" has been started!**\n\n` +
                 `🎮 **Teams Created:** ${result.teamsCreated}\n` +
                 `👥 **Total Participants:** ${result.totalParticipants}\n\n` +
                 `🏁 **Next Steps:**\n` +
                 `• Use \`/snlsetup\` to create team channels\n` +
                 `• Use \`/snlofficialstart\` to begin rolling\n\n` +
                 `Game is now in **active** status! 🎉`,
        components: []
      });
    } else {
      await interaction.editReply({
        content: `❌ Failed to start game "${game.name}": ${result.error}`,
        components: []
      });
    }

  } catch (error) {
    console.error('Error handling game selection for start:', error);
    await interaction.editReply({
      content: '❌ An error occurred while starting the selected game.',
      components: []
    });
  }
}
