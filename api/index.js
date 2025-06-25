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

// Utility function to sort players into teams
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

app.listen(PORT, () => {
  console.log(`SNL API server running on port ${PORT}`);
});

export default app;
