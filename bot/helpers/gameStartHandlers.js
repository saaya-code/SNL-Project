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

    if (acceptedApplications.length === 0) {
      return await interaction.editReply({ 
        content: `❌ No accepted participants found for "${game.name}".`
      });
    }

    // Check if we have enough participants
    const minParticipants = Math.max(2, game.maxTeamSize || 2);
    if (acceptedApplications.length < minParticipants) {
      return await interaction.editReply({ 
        content: `❌ Not enough participants to start the game. Need at least ${minParticipants}, but only ${acceptedApplications.length} accepted.`
      });
    }

    // Calculate number of teams needed
    const maxTeamSize = game.maxTeamSize || 4;
    const participantCount = acceptedApplications.length;
    let teamCount = Math.ceil(participantCount / maxTeamSize);
    
    // Ensure we have at least 2 teams
    if (teamCount === 1 && participantCount >= 2) {
      teamCount = 2;
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

    for (let i = 0; i < teams.length; i++) {
      const teamMembers = teams[i];
      if (teamMembers.length === 0) continue;

      const teamName = `Team ${String.fromCharCode(65 + i)}`; // Team A, Team B, etc.
      const teamId = generateTeamId();

      // Create private team channel
      const teamChannel = await guild.channels.create({
        name: `${game.name.toLowerCase().replace(/\s+/g, '-')}-${teamName.toLowerCase().replace(/\s+/g, '-')}`,
        type: ChannelType.GuildText,
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
      const coLeader = teamMembers.length > 1 ? teamMembers[1] : teamMembers[0]; // If only 1 member, they're both leader and co-leader

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
        coLeader: {
          userId: coLeader.userId,
          username: coLeader.username,
          displayName: coLeader.displayName
        },
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
          { name: '👥 Co-Leader', value: `<@${coLeader.userId}> (${coLeader.displayName})`, inline: true },
          { name: '📍 Starting Position', value: 'Tile 1', inline: true },
          { name: '👥 Team Members', value: teamMembers.map(m => `<@${m.userId}>`).join('\n') },
          { name: '🎲 Rolling', value: 'Only the leader and co-leader can use `/roll` to move the team!' },
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
