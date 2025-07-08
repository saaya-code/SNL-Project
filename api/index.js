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

// Middleware
app.use(express.json());

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
    res.status(201).json(newGame);
  } catch (error) {
    console.error('Error creating game:', error);
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

// Distribute teams without starting the game (for admin preview)
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

app.listen(PORT, () => {
  console.log(`SNL API server running on port ${PORT}`);
});

export default app;
