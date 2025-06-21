import express from 'express';
import mongoose from 'mongoose';
import Game from './models/Game.js';
import Application from './models/Application.js';
import Team from './models/Team.js';
import { generateGameBoard } from './services/gameboardGenerator.js';

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
    const { name, maxTeamSize = 1, createdBy } = req.body;
    
    const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const newGame = new Game({
      gameId,
      name,
      maxTeamSize,
      createdBy,
      channelId: 'dashboard-created',
      status: 'pending',
      tileTasks: new Map(),
      snakes: new Map(),
      ladders: new Map(),
      participants: [],
      snakeCount: 0,
      ladderCount: 0
    });
    
    await newGame.save();
    res.status(201).json(newGame);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/games/:gameId/start', async (req, res) => {
  try {
    const game = await Game.findOne({ gameId: req.params.gameId });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    game.status = 'active';
    await game.save();
    
    res.json(game);
  } catch (error) {
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
    
    const applicationId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
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
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/applications/:applicationId/accept', async (req, res) => {
  try {
    const { reviewerId, notes } = req.body;
    
    const application = await Application.findOne({ applicationId: req.params.applicationId });
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    application.status = 'accepted';
    application.reviewedAt = new Date();
    application.reviewedBy = reviewerId;
    if (notes) application.notes = notes;
    
    await application.save();
    res.json(application);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/applications/:applicationId/reject', async (req, res) => {
  try {
    const { reviewerId, notes } = req.body;
    
    const application = await Application.findOne({ applicationId: req.params.applicationId });
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    application.status = 'rejected';
    application.reviewedAt = new Date();
    application.reviewedBy = reviewerId;
    if (notes) application.notes = notes;
    
    await application.save();
    res.json(application);
  } catch (error) {
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

app.listen(PORT, () => {
  console.log(`SNL API server running on port ${PORT}`);
});

export default app;
