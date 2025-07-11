import express from 'express';
import mongoose from 'mongoose';
import Game from './models/Game.js';
import Application from './models/Application.js';
import Team from './models/Team.js';
import { generateGameBoard } from './services/gameboardGenerator.js';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://snl:snl2025@localhost:27017/snl?authSource=admin';

// Discord webhook functionality for announcements
async function sendRollAnnouncement(game, team, diceRoll, oldPosition, newPosition, snakeOrLadder) {
  const webhookUrl = game.announcementWebhookUrl;
  
  if (!webhookUrl) {
    console.log('No Discord webhook URL configured for this game, skipping announcement');
    return;
  }

  const embed = {
    title: "🎲 Team Roll Update",
    color: newPosition === 100 ? 0xffd700 : (snakeOrLadder && snakeOrLadder.includes('Snake')) ? 0xff4444 : (snakeOrLadder && snakeOrLadder.includes('Ladder')) ? 0x44ff44 : 0x0099ff,
    description: `**${team.teamName}** rolled **${diceRoll}** and moved from tile **${oldPosition}** to tile **${newPosition}**`,
    fields: [
      {
        name: "🎲 Dice Roll",
        value: diceRoll.toString(),
        inline: true
      },
      {
        name: "📍 Position",
        value: `${oldPosition} → ${newPosition}`,
        inline: true
      },
      {
        name: "🎮 Game",
        value: game.name,
        inline: true
      }
    ],
    timestamp: new Date().toISOString()
  };

  if (snakeOrLadder) {
    embed.fields.push({
      name: snakeOrLadder.includes('Snake') ? "🐍 Snake Alert!" : "🪜 Ladder Boost!",
      value: snakeOrLadder,
      inline: false
    });
  }

  if (newPosition >= 100) {
    embed.title = "🏆 WINNER!";
    embed.color = 0xffd700; // Gold color
    embed.description = `**${team.teamName}** has reached tile 100 and won the game! 🎉`;
    embed.fields.push({
      name: "🏆 VICTORY!",
      value: `**${team.teamName}** has won the game!`,
      inline: false
    });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [embed]
      })
    });

    if (!response.ok) {
      console.error('Failed to send Discord webhook:', response.statusText);
    } else {
      console.log(`Sent roll announcement for ${team.teamName} via Discord webhook`);
    }
  } catch (error) {
    console.error('Error sending Discord webhook:', error);
  }
}

// Middleware with more reasonable payload limits
app.use(express.json({ limit: '10mb' })); // Reduced from 300mb to 10mb
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// CORS middleware for dashboard access
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('API: Connected to MongoDB'))
  .catch(err => console.error('API: MongoDB connection error:', err));

// Create team distribution without saving to database (for preview)
function createTeamDistribution(acceptedApplications, gameId, maxTeamSize, devMode = false) {
  const teams = [];
  const shuffledApplications = [...acceptedApplications].sort(() => Math.random() - 0.5);
  
  // In DEV_MODE with only 1 player, create a single team
  if (devMode && shuffledApplications.length === 1) {
    const player = shuffledApplications[0];
    const teamId = uuidv4();
    const teamName = `Team ${player.displayName}`;
    
    const team = {
      teamId,
      gameId,
      teamName,
      members: [{
        userId: player.userId,
        username: player.username,
        displayName: player.displayName
      }],
      leader: {
        userId: player.userId,
        username: player.username,
        displayName: player.displayName
      },
      coLeader: {
        userId: player.userId,
        username: player.username,
        displayName: player.displayName
      },
      channelId: 'dashboard-team',
      currentPosition: 1,
      canRoll: true
    };
    
    teams.push(team);
    return teams;
  }
  
  // Normal team creation logic
  const numTeams = Math.ceil(shuffledApplications.length / maxTeamSize);
  
  for (let i = 0; i < numTeams; i++) {
    const startIndex = i * maxTeamSize;
    const endIndex = Math.min(startIndex + maxTeamSize, shuffledApplications.length);
    const teamMembers = shuffledApplications.slice(startIndex, endIndex);
    
    if (teamMembers.length === 0) continue;
    
    const teamId = uuidv4();
    const teamName = `Team ${i + 1}`;
    
    // Assign leader and co-leader
    const leader = teamMembers[0];
    const coLeader = teamMembers.length > 1 ? teamMembers[1] : teamMembers[0];
    
    const team = {
      teamId,
      gameId,
      teamName,
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
      channelId: 'dashboard-team',
      currentPosition: 1,
      canRoll: true
    };
    
    teams.push(team);
  }
  
  return teams;
}

async function sortPlayersIntoTeams(acceptedApplications, gameId, maxTeamSize, devMode = false) {
  const teams = [];
  const shuffledApplications = [...acceptedApplications].sort(() => Math.random() - 0.5);
  
  // In DEV_MODE with only 1 player, create a single team
  if (devMode && shuffledApplications.length === 1) {
    const player = shuffledApplications[0];
    const teamId = uuidv4();
    const teamName = `Team ${player.displayName}`;
    
    const team = new Team({
      teamId,
      gameId,
      teamName,
      members: [{
        userId: player.userId,
        username: player.username,
        displayName: player.displayName
      }],
      leader: {
        userId: player.userId,
        username: player.username,
        displayName: player.displayName
      },
      coLeader: {
        userId: player.userId,
        username: player.username,
        displayName: player.displayName
      },
      channelId: 'dashboard-team',
      currentPosition: 1,
      canRoll: true
    });
    
    await team.save();
    teams.push(team);
    return teams;
  }
  
  // Normal team creation logic
  const numTeams = Math.ceil(shuffledApplications.length / maxTeamSize);
  
  for (let i = 0; i < numTeams; i++) {
    const startIndex = i * maxTeamSize;
    const endIndex = Math.min(startIndex + maxTeamSize, shuffledApplications.length);
    const teamMembers = shuffledApplications.slice(startIndex, endIndex);
    
    if (teamMembers.length === 0) continue;
    
    const teamId = uuidv4();
    const teamName = `Team ${i + 1}`;
    
    // Assign leader and co-leader
    const leader = teamMembers[0];
    const coLeader = teamMembers.length > 1 ? teamMembers[1] : teamMembers[0];
    
    const team = new Team({
      teamId,
      gameId,
      teamName,
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
      channelId: 'dashboard-team',
      currentPosition: 1,
      canRoll: true
    });
    
    await team.save();
    teams.push(team);
  }
  
  return teams;
}

// Routes
app.get('/api/games', async (req, res) => {
  try {
    const games = await Game.find();
    res.json(games);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/games/:gameId', async (req, res) => {
  try {
    const game = await Game.findOne({ gameId: req.params.gameId });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    res.json(game);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Game board image generation route
app.get('/api/games/:gameId/board', async (req, res) => {
  try {
    const game = await Game.findOne({ gameId: req.params.gameId });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const teams = await Team.find({ gameId: req.params.gameId });
    
    const imageBuffer = await generateGameBoard(game, teams);
    
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': imageBuffer.length,
      'Cache-Control': 'no-cache'
    });
    
    res.send(imageBuffer);
  } catch (error) {
    console.error('Error generating game board:', error);
    res.status(500).json({ error: 'Failed to generate game board' });
  }
});

app.get('/api/applications', async (req, res) => {
  try {
    const { gameId, status } = req.query;
    const filter = {};
    
    if (gameId) filter.gameId = gameId;
    if (status) filter.status = status;
    
    const applications = await Application.find(filter).sort({ appliedAt: -1 });
    res.json(applications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/applications/:applicationId', async (req, res) => {
  try {
    const application = await Application.findOne({ applicationId: req.params.applicationId });
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    res.json(application);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/games/:gameId/applications', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { gameId: req.params.gameId };
    
    if (status) filter.status = status;
    
    const applications = await Application.find(filter).sort({ appliedAt: -1 });
    res.json(applications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Teams endpoints
app.get('/api/teams', async (req, res) => {
  try {
    const teams = await Team.find().sort({ createdAt: -1 });
    res.json(teams);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/teams/:teamId', async (req, res) => {
  try {
    const team = await Team.findOne({ teamId: req.params.teamId });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    res.json(team);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/games/:gameId/teams', async (req, res) => {
  try {
    const teams = await Team.find({ gameId: req.params.gameId }).sort({ currentPosition: -1 });
    res.json(teams);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:userId/teams', async (req, res) => {
  try {
    const teams = await Team.find({
      $or: [
        { 'leader.userId': req.params.userId },
        { 'coLeader.userId': req.params.userId },
        { 'members.userId': req.params.userId }
      ]
    }).sort({ createdAt: -1 });
    res.json(teams);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:userId/applications', async (req, res) => {
  try {
    const applications = await Application.find({ userId: req.params.userId }).sort({ appliedAt: -1 });
    res.json(applications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST endpoints for game actions
app.post('/api/games', async (req, res) => {
  try {
    const { 
      name, 
      maxTeamSize = 1, 
      createdBy = 'dashboard', 
      applicationDeadline,
      tileTasks = {},
      snakes = {},
      ladders = {},
      snakeCount = 0,
      ladderCount = 0
    } = req.body;
    
    console.log(`Creating game "${name}" with ${Object.keys(tileTasks).length} tiles`);
    logMemoryUsage();

    // Validate image sizes in tileTasks
    try {
      validateTileTasksSize(tileTasks);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    
    const gameId = uuidv4();
    
    const newGame = new Game({
      gameId,
      name,
      maxTeamSize,
      createdBy,
      applicationDeadline,
      channelId: 'dashboard-created',
      status: 'pending',
      tileTasks: new Map(Object.entries(tileTasks)),
      snakes: new Map(Object.entries(snakes).map(([k, v]) => [k, Number(v)])),
      ladders: new Map(Object.entries(ladders).map(([k, v]) => [k, Number(v)])),
      participants: [],
      snakeCount,
      ladderCount
    });
    
    await newGame.save();
    console.log(`Game "${name}" created successfully`);
    logMemoryUsage();
    
    res.status(201).json(newGame);
  } catch (error) {
    console.error('Error creating game:', error);
    logMemoryUsage();
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/games/:gameId/start', async (req, res) => {
  try {
    const game = await Game.findOne({ gameId: req.params.gameId });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Get all accepted applications for this game
    const acceptedApplications = await Application.find({ 
      gameId: req.params.gameId, 
      status: 'accepted' 
    });

    const DEV_MODE = process.env.DEV_MODE === 'true';
    
    // Validate minimum participants
    if (!DEV_MODE && acceptedApplications.length < 2) {
      return res.status(400).json({ 
        error: 'At least 2 accepted participants are required to start the game',
        acceptedCount: acceptedApplications.length,
        devMode: DEV_MODE
      });
    }

    if (acceptedApplications.length === 0) {
      return res.status(400).json({ 
        error: 'No accepted applications found for this game' 
      });
    }

    // Clear existing teams for this game
    await Team.deleteMany({ gameId: req.params.gameId });

    // Sort applications into teams
    const teamsCreated = await sortPlayersIntoTeams(
      acceptedApplications, 
      game.gameId, 
      game.maxTeamSize,
      DEV_MODE
    );

    // Update game status
    game.status = 'active';
    await game.save();
    
    res.json({
      ...game.toObject(),
      teamsCreated,
      acceptedApplications: acceptedApplications.length,
      devMode: DEV_MODE
    });
  } catch (error) {
    console.error('Error starting game:', error);
    res.status(500).json({ error: error.message });
  }
});

// Distribute teams without starting the game (for
app.post('/api/games/:gameId/distribute-teams', async (req, res) => {
  try {
    const game = await Game.findOne({ gameId: req.params.gameId });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Get all accepted applications for this game
    const acceptedApplications = await Application.find({ 
      gameId: req.params.gameId, 
      status: 'accepted' 
    });

    const DEV_MODE = process.env.DEV_MODE === 'true';
    
    // Validate minimum participants
    if (!DEV_MODE && acceptedApplications.length < 2) {
      return res.status(400).json({ 
        error: 'At least 2 accepted participants are required to start the game',
        acceptedCount: acceptedApplications.length,
        devMode: DEV_MODE
      });
    }

    if (acceptedApplications.length === 0) {
      return res.status(400).json({ 
        error: 'No accepted applications found for this game' 
      });
    }

    // Create team distribution preview (without saving to database)
    const teamDistribution = createTeamDistribution(
      acceptedApplications, 
      game.gameId, 
      game.maxTeamSize,
      DEV_MODE
    );

    res.json({
      teams: teamDistribution,
      acceptedApplications: acceptedApplications.length,
      devMode: DEV_MODE
    });
  } catch (error) {
    console.error('Error distributing teams:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start game with predefined teams
app.post('/api/games/:gameId/start-with-teams', async (req, res) => {
  try {
    const { teams } = req.body;
    
    if (!teams || !Array.isArray(teams)) {
      return res.status(400).json({ error: 'Teams array is required' });
    }

    const game = await Game.findOne({ gameId: req.params.gameId });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Clear existing teams for this game
    await Team.deleteMany({ gameId: req.params.gameId });

    // Create teams from the provided data
    const savedTeams = [];
    for (const teamData of teams) {
      const team = new Team({
        teamId: teamData.teamId,
        gameId: req.params.gameId,
        teamName: teamData.teamName,
        members: teamData.members,
        leader: teamData.leader,
        coLeader: teamData.coLeader,
        channelId: teamData.channelId || 'dashboard-team',
        currentPosition: 1,
        canRoll: true
      });
      
      await team.save();
      savedTeams.push(team);
    }

    // Update game status
    game.status = 'active';
    await game.save();
    
    res.json({
      ...game.toObject(),
      teamsCreated: savedTeams,
      acceptedApplications: savedTeams.reduce((total, team) => total + team.members.length, 0),
      devMode: process.env.DEV_MODE === 'true'
    });
  } catch (error) {
    console.error('Error starting game with teams:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/games/:gameId/start', async (req, res) => {
  try {
    const game = await Game.findOne({ gameId: req.params.gameId });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Get all accepted applications for this game
    const acceptedApplications = await Application.find({ 
      gameId: req.params.gameId, 
      status: 'accepted' 
    });

    const DEV_MODE = process.env.DEV_MODE === 'true';
    
    // Validate minimum participants
    if (!DEV_MODE && acceptedApplications.length < 2) {
      return res.status(400).json({ 
        error: 'At least 2 accepted participants are required to start the game',
        acceptedCount: acceptedApplications.length,
        devMode: DEV_MODE
      });
    }

    if (acceptedApplications.length === 0) {
      return res.status(400).json({ 
        error: 'No accepted applications found for this game' 
      });
    }

    // Clear existing teams for this game
    await Team.deleteMany({ gameId: req.params.gameId });

    // Sort applications into teams
    const teamsCreated = await sortPlayersIntoTeams(
      acceptedApplications, 
      game.gameId, 
      game.maxTeamSize,
      DEV_MODE
    );

    // Update game status
    game.status = 'active';
    await game.save();
    
    res.json({
      ...game.toObject(),
      teamsCreated,
      acceptedApplications: acceptedApplications.length,
      devMode: DEV_MODE
    });
  } catch (error) {
    console.error('Error starting game:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/games/:gameId/start-registration', async (req, res) => {
  try {
    const { maxTeamSize } = req.body;
    const game = await Game.findOne({ gameId: req.params.gameId });
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    game.status = 'registration';
    if (maxTeamSize) {
      game.maxTeamSize = maxTeamSize;
    }
    await game.save();
    
    res.json(game);
  } catch (error) {
    console.error('Error starting registration:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/games/:gameId/reset', async (req, res) => {
  try {
    const { resetType } = req.body;
    const game = await Game.findOne({ gameId: req.params.gameId });
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    if (resetType === 'active') {
      // Reset all teams in the game
      await Team.updateMany(
        { gameId: req.params.gameId },
        { 
          currentPosition: 1,
          canRoll: true 
        }
      );
    }
    
    res.json(game);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/games/:gameId', async (req, res) => {
  try {
    const game = await Game.findOneAndDelete({ gameId: req.params.gameId });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    // Also delete related teams and applications
    await Team.deleteMany({ gameId: req.params.gameId });
    await Application.deleteMany({ gameId: req.params.gameId });
    
    res.json({ message: 'Game deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Application actions
app.post('/api/applications', async (req, res) => {
  try {
    const { gameId, userId, username, displayName } = req.body;
    
    // Check if application already exists
    const existingApp = await Application.findOne({ gameId, userId });
    if (existingApp) {
      return res.status(400).json({ error: 'Application already exists for this game' });
    }
    
    const applicationId = uuidv4();
    
    const newApplication = new Application({
      applicationId,
      gameId,
      userId,
      username,
      displayName,
      channelId: 'dashboard-application',
      status: 'pending'
    });
    
    await newApplication.save();
    res.status(201).json(newApplication);
  } catch (error) {
    console.error('Error creating application:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/applications/:applicationId/accept', async (req, res) => {
  try {
    const { reviewerId, notes } = req.body;
    const { applicationId } = req.params;
    
    console.log(`Attempting to accept application: ${applicationId}`);
    console.log(`Request body:`, req.body);
    
    const application = await Application.findOne({ applicationId });
    if (!application) {
      console.log(`Application not found with ID: ${applicationId}`);
      // Let's check if there are any applications in the database
      const allApps = await Application.find({});
      console.log(`Total applications in database: ${allApps.length}`);
      if (allApps.length > 0) {
        console.log(`Sample application IDs:`, allApps.slice(0, 3).map(app => app.applicationId));
      }
      return res.status(404).json({ error: 'Application not found' });
    }
    
    console.log(`Found application:`, application);
    
    application.status = 'accepted';
    application.reviewedAt = new Date();
    application.reviewedBy = reviewerId;
    if (notes) application.notes = notes;
    
    await application.save();
    console.log(`Application accepted successfully`);
    res.json(application);
  } catch (error) {
    console.error('Error accepting application:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/applications/:applicationId/reject', async (req, res) => {
  try {
    const { reviewerId, notes } = req.body;
    const { applicationId } = req.params;
    
    console.log(`Attempting to reject application: ${applicationId}`);
    console.log(`Request body:`, req.body);
    
    const application = await Application.findOne({ applicationId });
    if (!application) {
      console.log(`Application not found with ID: ${applicationId}`);
      // Let's check if there are any applications in the database
      const allApps = await Application.find({});
      console.log(`Total applications in database: ${allApps.length}`);
      if (allApps.length > 0) {
        console.log(`Sample application IDs:`, allApps.slice(0, 3).map(app => app.applicationId));
      }
      return res.status(404).json({ error: 'Application not found' });
    }
    
    console.log(`Found application:`, application);
    
    application.status = 'rejected';
    application.reviewedAt = new Date();
    application.reviewedBy = reviewerId;
    if (notes) application.notes = notes;
    
    await application.save();
    console.log(`Application rejected successfully`);
    res.json(application);
  } catch (error) {
    console.error('Error rejecting application:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update application status (admin only)
app.put('/api/applications/:applicationId/status', async (req, res) => {
  try {
    const { status } = req.body;
    const { applicationId } = req.params;
    
    console.log(`Attempting to update application status: ${applicationId} to ${status}`);
    console.log(`Request body:`, req.body);
    
    // Validate status
    if (!['pending', 'accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be pending, accepted, or rejected' });
    }
    
    const application = await Application.findOne({ applicationId });
    if (!application) {
      console.log(`Application not found with ID: ${applicationId}`);
      return res.status(404).json({ error: 'Application not found' });
    }
    
    console.log(`Found application:`, application);
    
    // Update status
    const oldStatus = application.status;
    application.status = status;
    
    // Reset review fields if changing back to pending
    if (status === 'pending') {
      application.reviewedAt = null;
      application.reviewedBy = null;
      application.notes = null;
    } else if (oldStatus === 'pending') {
      // If changing from pending to accepted/rejected, set review timestamp
      application.reviewedAt = new Date();
    }
    
    await application.save();
    console.log(`Application status updated from ${oldStatus} to ${status}`);
    res.json(application);
  } catch (error) {
    console.error('Error updating application status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Team actions
app.post('/api/teams/:teamId/roll', async (req, res) => {
  try {
    const { userId } = req.body;
    
    const team = await Team.findOne({ teamId: req.params.teamId });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    // Check if user is leader or co-leader
    if (team.leader.userId !== userId && team.coLeader.userId !== userId) {
      return res.status(403).json({ error: 'Only team leaders can roll dice' });
    }
    
    if (!team.canRoll) {
      return res.status(400).json({ error: 'Team cannot roll dice at this time' });
    }
    
    // Roll the dice
    const diceRoll = Math.floor(Math.random() * 6) + 1;
    const oldPosition = team.currentPosition;
    let newPosition = Math.min(oldPosition + diceRoll, 100);
    
    // Get game details for snakes and ladders
    const game = await Game.findOne({ gameId: team.gameId });
    let snakeOrLadder = null;
    
    if (game) {
      // Check for snakes
      if (game.snakes.has(newPosition.toString())) {
        const snakeTail = game.snakes.get(newPosition.toString());
        newPosition = snakeTail;
        snakeOrLadder = `Snake! Slid down to ${snakeTail}`;
      }
      
      // Check for ladders
      if (game.ladders.has(newPosition.toString())) {
        const ladderTop = game.ladders.get(newPosition.toString());
        newPosition = ladderTop;
        snakeOrLadder = `Ladder! Climbed up to ${ladderTop}`;
      }
    }
    
    // Update team position
    team.currentPosition = newPosition;
    team.canRoll = false; // Prevent rolling again until next round
    await team.save();

    // Send announcement if webhook is configured
    if (game && game.announcementWebhookUrl) {
      try {
        await sendRollAnnouncement(game, team, diceRoll, oldPosition, newPosition, snakeOrLadder);
      } catch (error) {
        console.error('Failed to send roll announcement:', error);
      }
    }
    
    res.json({
      diceRoll,
      oldPosition,
      newPosition,
      snakeOrLadder
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Team verification endpoint
app.post('/api/teams/:teamId/verify', async (req, res) => {
  try {
    const { canRoll } = req.body;
    
    const team = await Team.findOne({ teamId: req.params.teamId });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    team.canRoll = canRoll;
    await team.save();
    
    res.json(team);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT endpoint to update team members (exchange between teams)
app.put('/api/teams/:teamId/members', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { members, leader, coLeader } = req.body;

    const team = await Team.findOne({ teamId });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check if game has started
    const game = await Game.findOne({ gameId: team.gameId });
    if (game && game.status === 'active') {
      return res.status(400).json({ error: 'Cannot modify teams after game has started' });
    }

    // Update team members
    team.members = members;
    if (leader) team.leader = leader;
    if (coLeader) team.coLeader = coLeader;

    await team.save();
    res.json(team);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT endpoint to exchange team members between two teams
app.put('/api/teams/exchange', async (req, res) => {
  try {
    const { sourceTeamId, targetTeamId, memberToMove } = req.body;

    // Get both teams
    const [sourceTeam, targetTeam] = await Promise.all([
      Team.findOne({ teamId: sourceTeamId }),
      Team.findOne({ teamId: targetTeamId })
    ]);

    if (!sourceTeam || !targetTeam) {
      return res.status(404).json({ error: 'One or both teams not found' });
    }

    // Check if game has started
    const game = await Game.findOne({ gameId: sourceTeam.gameId });
    if (game && game.status === 'active') {
      return res.status(400).json({ error: 'Cannot modify teams after game has started' });
    }

    // Remove member from source team
    sourceTeam.members = sourceTeam.members.filter(member => member.userId !== memberToMove.userId);
    
    // Add member to target team
    targetTeam.members.push(memberToMove);

    // Update leader/co-leader if necessary
    if (sourceTeam.leader.userId === memberToMove.userId) {
      sourceTeam.leader = sourceTeam.members.length > 0 ? sourceTeam.members[0] : sourceTeam.coLeader;
    }
    if (sourceTeam.coLeader.userId === memberToMove.userId) {
      sourceTeam.coLeader = sourceTeam.members.length > 1 ? sourceTeam.members[1] : sourceTeam.leader;
    }

    // Auto-assign leader/co-leader in target team if needed
    if (!targetTeam.leader || targetTeam.members.length === 1) {
      targetTeam.leader = targetTeam.members[0];
      targetTeam.coLeader = targetTeam.members.length > 1 ? targetTeam.members[1] : targetTeam.members[0];
    }

    // Save both teams
    await Promise.all([sourceTeam.save(), targetTeam.save()]);
    
    res.json({ sourceTeam, targetTeam });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT endpoint to update a specific tile in a game
app.put('/api/games/:gameId/tiles/:tileNumber', async (req, res) => {
  try {
    const { gameId, tileNumber } = req.params;
    const { name, description, imageUrl, uploadedImageUrl, uploadedImageName } = req.body;

    console.log(`Updating tile ${tileNumber} in game ${gameId}`, { name, description, imageUrl: imageUrl?.substring(0, 50) });
    logMemoryUsage();

    const game = await Game.findOne({ gameId });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Validate tile number
    const tileNum = parseInt(tileNumber);
    if (tileNum < 1 || tileNum > 100) {
      return res.status(400).json({ error: 'Tile number must be between 1 and 100' });
    }

    // Validate uploaded image if provided
    if (uploadedImageUrl) {
      try {
        validateAndOptimizeImage(uploadedImageUrl, 500); // 500KB limit per image
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }
    }

    // Update the specific tile
    const tileKey = tileNumber.toString();
    const currentTileTasks = game.tileTasks || new Map();
    
    if (name || description || imageUrl || uploadedImageUrl || uploadedImageName) {
      // Update or create tile task
      const tileTask = {
        name: name || '',
        description: description || '',
        imageUrl: imageUrl || '',
        uploadedImageUrl: uploadedImageUrl || '',
        uploadedImageName: uploadedImageName || ''
      };
      currentTileTasks.set(tileKey, tileTask);
    } else {
      // Remove tile task if all fields are empty
      currentTileTasks.delete(tileKey);
    }

    game.tileTasks = currentTileTasks;
    await game.save();
    
    res.json({
      message: 'Tile updated successfully',
      tile: {
        number: tileNum,
        task: currentTileTasks.get(tileKey) || null
      }
    });
  } catch (error) {
    console.error('Error updating tile:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET endpoint to get a specific tile from a game
app.get('/api/games/:gameId/tiles/:tileNumber', async (req, res) => {
  try {
    const { gameId, tileNumber } = req.params;

    const game = await Game.findOne({ gameId });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Validate tile number
    const tileNum = parseInt(tileNumber);
    if (tileNum < 1 || tileNum > 100) {
      return res.status(400).json({ error: 'Tile number must be between 1 and 100' });
    }

    const tileKey = tileNumber.toString();
    const tileTask = game.tileTasks?.get(tileKey) || null;
    
    res.json({
      number: tileNum,
      task: tileTask,
      hasSnake: game.snakes?.has(tileKey) || false,
      snakeEnd: game.snakes?.get(tileKey) || null,
      hasLadder: game.ladders?.has(tileKey) || false,
      ladderEnd: game.ladders?.get(tileKey) || null
    });
  } catch (error) {
    console.error('Error getting tile:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT endpoint to update snakes and ladders for a specific tile
app.put('/api/games/:gameId/tiles/:tileNumber/snake-ladder', async (req, res) => {
  try {
    const { gameId, tileNumber } = req.params;
    const { snakeEnd, ladderEnd, removeSnake, removeLadder } = req.body;

    const game = await Game.findOne({ gameId });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Validate tile number
    const tileNum = parseInt(tileNumber);
    if (tileNum < 1 || tileNum > 100) {
      return res.status(400).json({ error: 'Tile number must be between 1 and 100' });
    }

    const tileKey = tileNumber.toString();
    
    // Handle snake updates
    if (removeSnake) {
      game.snakes.delete(tileKey);
    } else if (snakeEnd !== undefined && snakeEnd !== null) {
      const snakeEndNum = parseInt(snakeEnd);
      if (snakeEndNum >= 1 && snakeEndNum < tileNum) {
        game.snakes.set(tileKey, snakeEndNum);
      } else {
        return res.status(400).json({ error: 'Snake end must be less than snake start and >= 1' });
      }
    }
    
    // Handle ladder updates
    if (removeLadder) {
      game.ladders.delete(tileKey);
    } else if (ladderEnd !== undefined && ladderEnd !== null) {
      const ladderEndNum = parseInt(ladderEnd);
      if (ladderEndNum > tileNum && ladderEndNum <= 100) {
        game.ladders.set(tileKey, ladderEndNum);
      } else {
        return res.status(400).json({ error: 'Ladder end must be greater than ladder start and <= 100' });
      }
    }

    await game.save();
    
    res.json({
      message: 'Snake/Ladder updated successfully',
      tile: {
        number: tileNum,
        hasSnake: game.snakes.has(tileKey),
        snakeEnd: game.snakes.get(tileKey) || null,
        hasLadder: game.ladders.has(tileKey),
        ladderEnd: game.ladders.get(tileKey) || null
      }
    });
  } catch (error) {
    console.error('Error updating snake/ladder:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT endpoint to update announcement channel for a game
app.put('/api/games/:gameId/announcement-channel', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { announcementChannelId, announcementWebhookUrl } = req.body;

    const game = await Game.findOne({ gameId });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (announcementChannelId !== undefined) {
      game.announcementChannelId = announcementChannelId;
    }
    if (announcementWebhookUrl !== undefined) {
      game.announcementWebhookUrl = announcementWebhookUrl;
    }
    
    await game.save();
    
    res.json(game);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/health-check", (req, res) => {
  console.log("Health check endpoint hit");
  res.status(200).json({ status: "OK" });
});

// Image optimization helpers
const validateAndOptimizeImage = (base64String, maxSizeKB = 500) => {
  if (!base64String || typeof base64String !== 'string') {
    return base64String;
  }

  // Check if it's a valid base64 image
  const base64Regex = /^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/;
  const match = base64String.match(base64Regex);
  
  if (!match) {
    return base64String; // Not a base64 image, return as-is
  }

  const imageData = match[2];
  const imageSizeBytes = (imageData.length * 3) / 4; // Approximate size of base64 decoded data
  const imageSizeKB = imageSizeBytes / 1024;

  console.log(`Image size: ${Math.round(imageSizeKB)}KB`);

  if (imageSizeKB > maxSizeKB) {
    throw new Error(`Image too large: ${Math.round(imageSizeKB)}KB. Maximum allowed: ${maxSizeKB}KB. Please compress your image.`);
  }

  return base64String;
};

const validateTileTasksSize = (tileTasks) => {
  if (!tileTasks || typeof tileTasks !== 'object') {
    return;
  }

  let totalImageSize = 0;
  let imageCount = 0;

  for (const [tileKey, task] of Object.entries(tileTasks)) {
    if (task && task.uploadedImageUrl) {
      try {
        validateAndOptimizeImage(task.uploadedImageUrl, 500); // 500KB per image
        
        // Calculate approximate size
        const base64Match = task.uploadedImageUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
        if (base64Match) {
          const imageSize = (base64Match[1].length * 3) / 4 / 1024; // KB
          totalImageSize += imageSize;
          imageCount++;
        }
      } catch (error) {
        throw new Error(`Tile ${tileKey}: ${error.message}`);
      }
    }
  }

  console.log(`Total images: ${imageCount}, Total size: ${Math.round(totalImageSize)}KB`);

  // Limit total image payload to 8MB (leaving 2MB for other data)
  if (totalImageSize > 8192) { // 8MB in KB
    throw new Error(`Total image payload too large: ${Math.round(totalImageSize)}KB. Maximum allowed: 8192KB (8MB). Please reduce image sizes or count.`);
  }
};

// Memory usage logging function
function logMemoryUsage() {
  const usage = process.memoryUsage();
  console.log(`Memory Usage - RSS: ${Math.round(usage.rss / 1024 / 1024)}MB, Heap: ${Math.round(usage.heapUsed / 1024 / 1024)}MB/${Math.round(usage.heapTotal / 1024 / 1024)}MB, External: ${Math.round(usage.external / 1024 / 1024)}MB`);
}

// Log memory usage every 5 minutes
setInterval(logMemoryUsage, 5 * 60 * 1000);

// Log memory usage on startup
logMemoryUsage();

app.listen(PORT, () => {
  console.log(`SNL API server running on port ${PORT}`);
});

export default app;
