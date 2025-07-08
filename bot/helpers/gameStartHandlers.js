import { EmbedBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import Game from '../models/Game.js';
import Application from '../models/Application.js';
import Team from '../models/Team.js';

// Function to shuffle array randomly
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Generate unique team ID
function generateTeamId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Handle game selection for starting
export async function handleSelectGameToStart(interaction) {
  if (!interaction.member.permissions.has('Administrator')) {
    return await interaction.editReply({ 
      content: '❌ You need Administrator permissions to start games.'
    });
  }

  const gameId = interaction.values[0].replace('start_game_', '');
  
  try {
    // Get the game details
    const game = await Game.findOne({ gameId: gameId });
    if (!game) {
      return await interaction.editReply({ 
        content: '❌ Game not found.'
      });
    }

    // Check if game is in registration status
    if (game.status !== 'registration') {
      return await interaction.editReply({ 
        content: `❌ Game "${game.name}" is not in registration status. Current status: ${game.status}`
      });
    }

    // Get accepted applications for this game
    const acceptedApplications = await Application.find({ 
      gameId: gameId, 
      status: 'accepted' 
    });

    console.log('Accepted applications found (numbered teams):', acceptedApplications.length);
    
    // Validate all applications have required fields
    for (const app of acceptedApplications) {
      if (!app.username || !app.displayName) {
        console.error('Application missing required fields:', {
          applicationId: app.applicationId,
          userId: app.userId,
          username: app.username,
          displayName: app.displayName
        });
        return await interaction.editReply({ 
          content: `❌ Application data is incomplete for user ${app.userId}. Please contact an administrator.`
        });
      }
    }

    if (acceptedApplications.length === 0) {
      return await interaction.editReply({ 
        content: `❌ No accepted participants found for "${game.name}".`
      });
    }

    // Check if we have enough participants
    const isDevelopmentMode = process.env.DEV_MODE === 'true';
    const minParticipants = isDevelopmentMode ? 1 : Math.max(2, game.maxTeamSize || 2);
    
    if (acceptedApplications.length < minParticipants) {
      const devModeNote = isDevelopmentMode ? ' (Development mode: minimum 1 participant)' : '';
      return await interaction.editReply({ 
        content: `❌ Not enough participants to start the game. Need at least ${minParticipants}, but only ${acceptedApplications.length} accepted.${devModeNote}`
      });
    }

    // Calculate number of teams needed
    const maxTeamSize = game.maxTeamSize || 4;
    const participantCount = acceptedApplications.length;
    let teamCount;
    
    if (isDevelopmentMode && participantCount === 1) {
      // In dev mode with 1 participant, create just 1 team
      teamCount = 1;
    } else {
      teamCount = Math.ceil(participantCount / maxTeamSize);
      // Ensure we have at least 2 teams (except in dev mode with 1 participant)
      if (teamCount === 1 && participantCount >= 2) {
        teamCount = 2;
      }
    }

    // Shuffle participants randomly
    const shuffledParticipants = shuffleArray(acceptedApplications);

    // Create teams
    const teams = [];
    for (let i = 0; i < teamCount; i++) {
      teams.push([]);
    }

    // Distribute participants round-robin style for balanced teams
    shuffledParticipants.forEach((participant, index) => {
      const teamIndex = index % teamCount;
      teams[teamIndex].push(participant);
    });

    // Create team channels and save team data
    const createdTeams = [];
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

    for (let i = 0; i < teams.length; i++) {
      const teamMembers = teams[i];
      if (teamMembers.length === 0) continue;

      const teamName = `Team ${String.fromCharCode(65 + i)}`; // Team A, Team B, etc.
      const teamId = generateTeamId();

      // Create private team channel
      const teamChannel = await guild.channels.create({
        name: `${game.name.toLowerCase().replace(/\s+/g, '-')}-${teamName.toLowerCase().replace(/\s+/g, '-')}`,
        type: ChannelType.GuildText,
        parent: gameCategory.id,
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          // Add permissions for team members
          ...teamMembers.map(member => ({
            id: member.userId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
          })),
          // Add permissions for moderators/admins
          {
            id: interaction.member.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages],
          }
        ],
      });

      // Assign leader and co-leader
      const leader = teamMembers[0];
      const coLeader = teamMembers.length > 1 ? teamMembers[1] : null; // If only 1 member, no co-leader

      // Create team object
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
        channelId: teamChannel.id,
        currentPosition: 1,
        canRoll: true
      });

      await teamData.save();
      createdTeams.push(teamData);

      // Send welcome message to team channel
      const teamEmbed = new EmbedBuilder()
        .setTitle(`🎮 Welcome to ${teamName}!`)
        .setDescription(`Welcome to **${game.name}**! Your team has been created and the game is about to begin.`)
        .addFields(
          { name: '👑 Team Leader', value: `<@${leader.userId}> (${leader.displayName})`, inline: true },
          { name: '👥 Co-Leader', value: coLeader ? `<@${coLeader.userId}> (${coLeader.displayName})` : 'None', inline: true },
          { name: '📍 Starting Position', value: 'Tile 1', inline: true },
          { name: '👥 Team Members', value: teamMembers.map(m => `<@${m.userId}>`).join('\n') },
          { name: '🎲 Rolling', value: coLeader ? 'Only the leader and co-leader can use `/roll` to move the team!' : 'Only the team leader can use `/roll` to move the team!' },
          { name: '🎯 Objective', value: 'Work together to reach tile 100 first!' }
        )
        .setColor('#00ff00')
        .setTimestamp();

      await teamChannel.send({ embeds: [teamEmbed] });
    }

    // Update game status to active
    game.status = 'active';
    game.startedAt = new Date();
    await game.save();

    // Send initial announcement to SNL announcements channel
    if (game.announcementChannelId) {
      try {
        const announcementsChannel = await guild.channels.fetch(game.announcementChannelId);
        if (announcementsChannel) {
          const gameStartEmbed = new EmbedBuilder()
            .setTitle(`🎮 ${game.name} - Game Started!`)
            .setDescription(`The Snakes & Ladders game has officially begun!`)
            .addFields(
              { name: '👥 Participants', value: acceptedApplications.length.toString(), inline: true },
              { name: '🏆 Teams', value: createdTeams.length.toString(), inline: true },
              { name: '📅 Started', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
              { name: '🎯 Objective', value: 'First team to reach tile 100 wins!' },
              { name: '🎲 How to Play', value: 'Team leaders and co-leaders can use `/roll` to move their team forward!' }
            )
            .setColor('#00ff00')
            .setTimestamp();

          await announcementsChannel.send({ embeds: [gameStartEmbed] });
        }
      } catch (error) {
        console.error('Failed to send game start announcement:', error);
      }
    }

    // Create summary embed
    const summaryEmbed = new EmbedBuilder()
      .setTitle(`🎮 ${game.name} - Game Started!`)
      .setDescription(`The game has been successfully started with ${createdTeams.length} teams!`)
      .addFields(
        { name: '👥 Total Participants', value: acceptedApplications.length.toString(), inline: true },
        { name: '🏆 Teams Created', value: createdTeams.length.toString(), inline: true },
        { name: '📅 Started At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        { name: '🏁 Teams', value: createdTeams.map(team => 
          `**${team.teamName}**: ${team.members.length} members\n` +
          `Leader: ${team.leader.displayName}\n` +
          `Channel: <#${team.channelId}>`
        ).join('\n\n') }
      )
      .setColor('#00ff00')
      .setFooter({ text: `Started by ${interaction.user.displayName}` })
      .setTimestamp();

    await interaction.editReply({ 
      content: '✅ Game started successfully!',
      embeds: [summaryEmbed],
      components: []
    });

  } catch (error) {
    console.error('Error starting game:', error);
    await interaction.editReply({ 
      content: '❌ Failed to start game. Please try again later.',
      components: []
    });
  }
}

// Wrapper function for starting game with participants (used by snlStartGame command)
export async function startGameWithParticipants(interaction, gameId) {
  try {
    // Get the game details
    const game = await Game.findOne({ gameId: gameId });
    if (!game) {
      return await interaction.editReply({ 
        content: '❌ Game not found.'
      });
    }

    // Check if game is in registration status
    if (game.status !== 'registration') {
      return await interaction.editReply({ 
        content: `❌ Game "${game.name}" is not in registration status. Current status: ${game.status}`
      });
    }

    // Get accepted applications for this game
    const acceptedApplications = await Application.find({ 
      gameId: gameId, 
      status: 'accepted' 
    });

    console.log('Accepted applications found:', acceptedApplications.length);
    
    // Validate all applications have required fields
    for (const app of acceptedApplications) {
      if (!app.username || !app.displayName) {
        console.error('Application missing required fields:', {
          applicationId: app.applicationId,
          userId: app.userId,
          username: app.username,
          displayName: app.displayName
        });
        return await interaction.editReply({ 
          content: `❌ Application data is incomplete for user ${app.userId}. Please contact an administrator.`
        });
      }
    }

    if (acceptedApplications.length === 0) {
      return await interaction.editReply({ 
        content: `❌ No accepted participants found for "${game.name}".`
      });
    }

    // Check if we have enough participants
    const isDevelopmentMode = process.env.DEV_MODE === 'true';
    const minParticipants = isDevelopmentMode ? 1 : Math.max(2, game.maxTeamSize || 2);
    
    if (acceptedApplications.length < minParticipants) {
      const devModeNote = isDevelopmentMode ? ' (Development mode: minimum 1 participant)' : '';
      return await interaction.editReply({ 
        content: `❌ Not enough participants to start the game. Need at least ${minParticipants}, but only ${acceptedApplications.length} accepted.${devModeNote}`
      });
    }

    // Calculate number of teams needed
    const maxTeamSize = game.maxTeamSize || 4;
    const participantCount = acceptedApplications.length;
    let teamCount;
    
    if (isDevelopmentMode && participantCount === 1) {
      // In dev mode with 1 participant, create just 1 team
      teamCount = 1;
    } else {
      teamCount = Math.ceil(participantCount / maxTeamSize);
      // Ensure we have at least 2 teams (except in dev mode with 1 participant)
      if (teamCount === 1 && participantCount >= 2) {
        teamCount = 2;
      }
    }

    // Shuffle participants randomly
    const shuffledParticipants = shuffleArray(acceptedApplications);

    // Create teams
    const teams = [];
    for (let i = 0; i < teamCount; i++) {
      teams.push([]);
    }

    // Distribute participants round-robin style for balanced teams
    shuffledParticipants.forEach((participant, index) => {
      const teamIndex = index % teamCount;
      teams[teamIndex].push(participant);
    });

    // Create team channels and save team data
    const createdTeams = [];
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
            id: guild.id,
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

    // Store announcements channel ID in game for future reference
    game.announcementChannelId = announcementsChannel.id;
    await game.save();

    // Create teams and channels
    for (let i = 0; i < teams.length; i++) {
      const teamMembers = teams[i];
      if (teamMembers.length === 0) continue;

      const teamId = generateTeamId();
      const teamName = `Team ${String.fromCharCode(65 + i)}`; // Team A, Team B, etc.

      // Assign leader and co-leader
      const leader = teamMembers[0];
      const coLeader = teamMembers.length > 1 ? teamMembers[1] : null;

      // Ensure required fields exist for leader
      if (!leader.username || !leader.displayName) {
        console.error('Leader missing required fields:', { 
          userId: leader.userId, 
          username: leader.username, 
          displayName: leader.displayName 
        });
        throw new Error(`Leader application missing required fields: username=${leader.username}, displayName=${leader.displayName}`);
      }

      // Ensure required fields exist for co-leader (if exists)
      if (coLeader) {
        if (!coLeader.username || !coLeader.displayName) {
          console.error('Co-leader missing required fields:', { 
            userId: coLeader.userId, 
            username: coLeader.username, 
            displayName: coLeader.displayName 
          });
          throw new Error(`Co-leader application missing required fields: username=${coLeader.username}, displayName=${coLeader.displayName}`);
        }
      }

      // Validate all team members have required fields
      for (const member of teamMembers) {
        if (!member.username || !member.displayName) {
          console.error('Team member missing required fields:', { 
            userId: member.userId, 
            username: member.username, 
            displayName: member.displayName 
          });
          throw new Error(`Team member application missing required fields: username=${member.username}, displayName=${member.displayName}`);
        }
      }

      // Create team channel
      const teamChannel = await guild.channels.create({
        name: `team-${teamName.toLowerCase().replace(' ', '-')}`,
        type: ChannelType.GuildText,
        parent: gameCategory,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          // Add permissions for all team members
          ...teamMembers.map(member => ({
            id: member.userId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          })),
        ],
      });

      // Create team data
      const teamData = new Team({
        teamId: teamId,
        gameId: gameId,
        teamName: teamName,
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
        members: teamMembers.map(member => ({
          userId: member.userId,
          username: member.username,
          displayName: member.displayName
        })),
        currentPosition: 1,
        canRoll: true,
        channelId: teamChannel.id
      });

      await teamData.save();
      createdTeams.push(teamData);

      // Send welcome message to team channel
      const welcomeEmbed = new EmbedBuilder()
        .setTitle(`🎉 Welcome to ${teamName}!`)
        .setDescription(`Your team has been created for the game **${game.name}**`)
        .addFields(
          { name: '👑 Team Leader', value: leader.displayName, inline: true },
          { name: '🤝 Co-Leader', value: coLeader ? coLeader.displayName : 'None', inline: true },
          { name: '👥 Team Members', value: teamMembers.map(m => m.displayName).join('\n') || 'None' },
          { name: '🎯 Your Mission', value: 'Work together to reach tile 100 first! Use `/roll` to move forward.' },
          { name: '🎲 Getting Started', value: coLeader ? 'Only the **Team Leader** and **Co-Leader** can roll the dice. Good luck!' : 'Only the **Team Leader** can roll the dice. Good luck!' }
        )
        .setColor('#00ff00')
        .setFooter({ text: `Game started by ${interaction.user.displayName}` })
        .setTimestamp();

      await teamChannel.send({ embeds: [welcomeEmbed] });
    }

    // Update game status to active
    game.status = 'active';
    game.startedAt = new Date();
    await game.save();

    // Send initial announcement to SNL announcements channel
    if (game.announcementChannelId) {
      try {
        const announcementsChannel = await guild.channels.fetch(game.announcementChannelId);
        if (announcementsChannel) {
          const gameStartEmbed = new EmbedBuilder()
            .setTitle(`🎮 ${game.name} - Game Started!`)
            .setDescription(`The Snakes & Ladders game has officially begun!`)
            .addFields(
              { name: '👥 Participants', value: acceptedApplications.length.toString(), inline: true },
              { name: '🏆 Teams', value: createdTeams.length.toString(), inline: true },
              { name: '📅 Started', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
              { name: '🎯 Objective', value: 'First team to reach tile 100 wins!' },
              { name: '🎲 How to Play', value: 'Team leaders and co-leaders can use `/roll` to move their team forward!' }
            )
            .setColor('#00ff00')
            .setTimestamp();

          // Add development mode note if applicable
          if (isDevelopmentMode && acceptedApplications.length === 1) {
            gameStartEmbed.addFields({
              name: '🔧 Development Mode',
              value: 'Game started with only 1 participant (development mode enabled)',
              inline: false
            });
          }

          await announcementsChannel.send({ embeds: [gameStartEmbed] });
        }
      } catch (error) {
        console.error('Failed to send game start announcement:', error);
      }
    }

    // Create summary embed
    const summaryEmbed = new EmbedBuilder()
      .setTitle(`🎮 ${game.name} - Game Started!`)
      .setDescription(`The game has been successfully started with ${createdTeams.length} team${createdTeams.length === 1 ? '' : 's'}!`)
      .addFields(
        { name: '👥 Total Participants', value: acceptedApplications.length.toString(), inline: true },
        { name: '🏆 Teams Created', value: createdTeams.length.toString(), inline: true },
        { name: '📅 Started At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
      )
      .setColor('#00ff00')
      .setFooter({ text: `Started by ${interaction.user.displayName}` })
      .setTimestamp();

    // Add development mode note if applicable
    if (isDevelopmentMode && acceptedApplications.length === 1) {
      summaryEmbed.addFields({
        name: '🔧 Development Mode',
        value: 'Game started with only 1 participant (development mode enabled)',
        inline: false
      });
    }

    // Add team details
    if (createdTeams.length <= 10) { // Only show details if not too many teams
      summaryEmbed.addFields({
        name: '🏁 Teams',
        value: createdTeams.map(team => 
          `**${team.teamName}**: ${team.members.length} member${team.members.length === 1 ? '' : 's'}\n` +
          `Leader: ${team.leader.displayName}\n` +
          (team.coLeader ? `Co-Leader: ${team.coLeader.displayName}\n` : '') +
          `Channel: <#${team.channelId}>`
        ).join('\n\n'),
        inline: false
      });
    }

    await interaction.editReply({ 
      embeds: [summaryEmbed],
      components: []
    });

  } catch (error) {
    console.error('Error starting game with participants:', error);
    await interaction.editReply({ 
      content: '❌ Failed to start game. Please try again later.',
      components: []
    });
  }
}
