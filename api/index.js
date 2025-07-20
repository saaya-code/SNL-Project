import express from 'express';
import mongoose from 'mongoose';
import Game from './models/Game.js';
import Application from './models/Application.js';
import Team from './models/Team.js';
import { generateGameBoard } from './services/gameboardGenerator.js';
import { v4 as uuidv4 } from 'uuid';

// Request queue and concurrency control for board generation
class BoardGenerationQueue {
  constructor(maxConcurrent = 3) { // Increased from 2 to 3
    this.maxConcurrent = maxConcurrent;
    this.currentRequests = 0;
    this.queue = [];
    this.cache = new Map(); // Simple in-memory cache for boards
    this.cacheTimeout = 15 * 60 * 1000; // Extended to 15 minutes cache
    this.requestTimeouts = new Map(); // Track request timeouts
    this.maxRequestTimeout = 30000; // 30 seconds max per request
  }

  async processRequest(gameId, game, teams, requestId) {
    // Check cache first
    const cacheKey = this.generateCacheKey(gameId, teams);
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      const cacheAge = Math.round((Date.now() - cached.timestamp) / 1000);
      console.log(`🎯 [${requestId}] Serving from cache - Age: ${cacheAge}s`);
      return cached.buffer;
    }

    // If at capacity, implement smart queuing
    if (this.currentRequests >= this.maxConcurrent) {
      // Check if there's already a request for this exact game state in queue
      const existingQueueItem = this.queue.find(item => 
        this.generateCacheKey(item.gameId, item.teams) === cacheKey
      );
      
      if (existingQueueItem) {
        console.log(`⏳ [${requestId}] Joining existing queue for same game state`);
        return new Promise((resolve, reject) => {
          // Add to the existing queue item's waiters
          if (!existingQueueItem.waiters) {
            existingQueueItem.waiters = [];
          }
          existingQueueItem.waiters.push({ resolve, reject, requestId });
        });
      }

      console.log(`⏳ [${requestId}] Request queued - Current active: ${this.currentRequests}/${this.maxConcurrent}, Queue: ${this.queue.length}`);
      
      return new Promise((resolve, reject) => {
        const queueItem = { 
          gameId, 
          game, 
          teams, 
          requestId, 
          resolve, 
          reject,
          queuedAt: Date.now(),
          waiters: [] // Other requests waiting for the same result
        };
        
        this.queue.push(queueItem);
        
        // Set timeout for queued request
        setTimeout(() => {
          const index = this.queue.findIndex(item => item.requestId === requestId);
          if (index !== -1) {
            this.queue.splice(index, 1);
            reject(new Error('Request timeout - too many concurrent requests'));
          }
        }, this.maxRequestTimeout);
      });
    }

    return this.executeRequest(gameId, game, teams, requestId);
  }

  async executeRequest(gameId, game, teams, requestId) {
    this.currentRequests++;
    const startTime = Date.now();
    console.log(`🚀 [${requestId}] Starting board generation - Active: ${this.currentRequests}/${this.maxConcurrent}`);

    // Set request timeout
    const timeoutId = setTimeout(() => {
      console.error(`⏰ [${requestId}] Request timeout after ${this.maxRequestTimeout}ms`);
    }, this.maxRequestTimeout);

    this.requestTimeouts.set(requestId, timeoutId);

    try {
      const buffer = await generateGameBoard(game, teams);
      
      // Cache the result
      const cacheKey = this.generateCacheKey(gameId, teams);
      this.cache.set(cacheKey, {
        buffer: Buffer.from(buffer), // Create a copy to avoid reference issues
        timestamp: Date.now()
      });
      
      // Cleanup old cache entries periodically
      if (Math.random() < 0.1) { // 10% chance to cleanup
        this.cleanupCache();
      }
      
      const duration = Date.now() - startTime;
      console.log(`✅ [${requestId}] Board generation complete in ${duration}ms - Active: ${this.currentRequests}/${this.maxConcurrent}`);
      
      return buffer;
    } finally {
      // Clear timeout
      const timeoutId = this.requestTimeouts.get(requestId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.requestTimeouts.delete(requestId);
      }

      this.currentRequests--;
      
      // Process next queued request
      if (this.queue.length > 0) {
        const nextRequest = this.queue.shift();
        const queueWaitTime = Date.now() - nextRequest.queuedAt;
        console.log(`⏭️  Processing queued request after ${queueWaitTime}ms wait - Queue size: ${this.queue.length}`);
        
        // Execute next request asynchronously
        setImmediate(() => {
          this.executeRequest(nextRequest.gameId, nextRequest.game, nextRequest.teams, nextRequest.requestId)
            .then(result => {
              // Resolve the main request
              nextRequest.resolve(result);
              
              // Resolve all waiters for the same result
              if (nextRequest.waiters && nextRequest.waiters.length > 0) {
                console.log(`📤 [${nextRequest.requestId}] Broadcasting result to ${nextRequest.waiters.length} waiters`);
                nextRequest.waiters.forEach(waiter => {
                  console.log(`📤 Broadcasting to [${waiter.requestId}]`);
                  waiter.resolve(result);
                });
              }
            })
            .catch(error => {
              nextRequest.reject(error);
              
              // Reject all waiters
              if (nextRequest.waiters && nextRequest.waiters.length > 0) {
                nextRequest.waiters.forEach(waiter => {
                  waiter.reject(error);
                });
              }
            });
        });
      }
    }
  }

  generateCacheKey(gameId, teams) {
    // Generate cache key based on game state and team positions
    const teamPositions = teams.map(t => `${t.teamId}:${t.currentPosition}`).sort().join(',');
    const gameStateHash = `${gameId}:${teamPositions}`;
    return gameStateHash;
  }

  // Invalidate cache for a specific game when game state changes
  invalidateGameCache(gameId) {
    let invalidatedCount = 0;
    
    // Remove all cache entries for this specific game
    for (const [cacheKey, cached] of this.cache.entries()) {
      if (cacheKey.startsWith(`${gameId}:`)) {
        this.cache.delete(cacheKey);
        invalidatedCount++;
      }
    }
    
    if (invalidatedCount > 0) {
      console.log(`🗑️ Invalidated ${invalidatedCount} cache entries for game ${gameId}`);
    }
    
    return invalidatedCount;
  }

  // Add method to invalidate all cache
  invalidateAllCache() {
    const cacheSize = this.cache.size;
    this.cache.clear();
    console.log(`🗑️ Invalidated all ${cacheSize} cache entries`);
    return cacheSize;
  }

  // Invalidate cache for a specific game when game state changes
  invalidateGameCache(gameId) {
    let invalidatedCount = 0;
    
    // Remove all cache entries for this specific game
    for (const [cacheKey, cached] of this.cache.entries()) {
      if (cacheKey.startsWith(`${gameId}:`)) {
        this.cache.delete(cacheKey);
        invalidatedCount++;
      }
    }
    
    if (invalidatedCount > 0) {
      console.log(`🗑️ Invalidated ${invalidatedCount} cache entries for game ${gameId}`);
    }
    
    return invalidatedCount;
  }

  // Add method to invalidate all cache
  invalidateAllCache() {
    const cacheSize = this.cache.size;
    this.cache.clear();
    console.log(`🗑️ Invalidated all ${cacheSize} cache entries`);
    return cacheSize;
  }

  cleanupCache() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} expired cache entries - Current cache size: ${this.cache.size}`);
    }
  }

  getStats() {
    return {
      currentRequests: this.currentRequests,
      queueLength: this.queue.length,
      cacheSize: this.cache.size,
      maxConcurrent: this.maxConcurrent,
      averageCacheAge: this.getAverageCacheAge()
    };
  }

  getAverageCacheAge() {
    if (this.cache.size === 0) return 0;
    
    const now = Date.now();
    const totalAge = Array.from(this.cache.values())
      .reduce((sum, cached) => sum + (now - cached.timestamp), 0);
    
    return Math.round(totalAge / this.cache.size / 1000); // Return in seconds
  }

  // Emergency method to clear everything if memory gets too high
  clearAll() {
    console.warn('🚨 Emergency: Clearing board generation queue and cache');
    this.queue.length = 0;
    this.cache.clear();
    this.requestTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this.requestTimeouts.clear();
  }
}


// Initialize the queue with improved concurrency settings
const boardQueue = new BoardGenerationQueue(3); // Increased to 3 concurrent

// Monitor queue stats every minute
setInterval(() => {
  const stats = boardQueue.getStats();
  if (stats.currentRequests > 0 || stats.queueLength > 0 || stats.cacheSize > 0) {
    console.log(`📊 Board Queue Stats: Active: ${stats.currentRequests}, Queued: ${stats.queueLength}, Cache: ${stats.cacheSize} entries (avg age: ${stats.averageCacheAge}s)`);
  }
}, 60000);

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://snl:snl2025@localhost:27017/snl?authSource=admin';

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
  const requestId = uuidv4().substring(0, 8);
  const startTime = Date.now();
  const initialMemory = process.memoryUsage();
  
  console.log(`🎯 [${requestId}] Board generation request started - Initial memory: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);
  console.log(`📊 [${requestId}] Queue stats: ${JSON.stringify(boardQueue.getStats())}`);
  
  let imageBuffer = null;
  
  try {
    const game = await Game.findOne({ gameId: req.params.gameId });
    if (!game) {
      console.log(`❌ [${requestId}] Game not found: ${req.params.gameId}`);
      return res.status(404).json({ error: 'Game not found' });
    }

    const teams = await Team.find({ gameId: req.params.gameId });
    console.log(`📊 [${requestId}] Found game "${game.name}" with ${teams.length} teams`);
    
    // Check current memory before generation
    const beforeGeneration = process.memoryUsage();
    const memoryUsageMB = Math.round(beforeGeneration.heapUsed / 1024 / 1024);
    console.log(`📋 [${requestId}] Memory before generation: ${memoryUsageMB}MB`);
    
    // Emergency memory check - clear cache if memory is too high
    if (memoryUsageMB > 800) { // 800MB threshold
      console.warn(`🚨 [${requestId}] High memory usage (${memoryUsageMB}MB), clearing board cache`);
      boardQueue.clearAll();
      
      // Force garbage collection if available
      if (global.gc && process.env.NODE_ENV !== 'production') {
        global.gc();
        const afterGC = process.memoryUsage();
        console.log(`🧹 [${requestId}] Memory after GC: ${Math.round(afterGC.heapUsed / 1024 / 1024)}MB`);
      }
    }
    
    // Use the queue system with client identification to prevent concurrent overload
    imageBuffer = await boardQueue.processRequest(req.params.gameId, game, teams, requestId);
    
    // Check memory after generation
    const afterGeneration = process.memoryUsage();
    console.log(`🖼️  [${requestId}] Board generated successfully - Size: ${Math.round(imageBuffer.length / 1024)}KB, Memory: ${Math.round(afterGeneration.heapUsed / 1024 / 1024)}MB`);
    
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': imageBuffer.length,
      'Cache-Control': 'public, max-age=900', // 15 minute browser cache to reduce requests
      'X-Request-ID': requestId,
      'X-Queue-Stats': JSON.stringify(boardQueue.getStats()),
      'X-Cache-Advice': 'Consider caching this response for 15 minutes'
    });
    
    res.send(imageBuffer);
    
    const endTime = Date.now();
    const finalMemory = process.memoryUsage();
    console.log(`✅ [${requestId}] Board generation complete - Total time: ${endTime - startTime}ms, Final memory: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);
    
  } catch (error) {
    const errorMemory = process.memoryUsage();
    console.error(`❌ [${requestId}] Error generating game board (Memory: ${Math.round(errorMemory.heapUsed / 1024 / 1024)}MB):`, error);
    
    // Handle different types of errors
    if (error.message.includes('Rate limit exceeded')) {
      res.status(429).json({ 
        error: 'Too many requests. Please wait before requesting the board again.',
        requestId: requestId,
        retryAfter: 30,
        queueStats: boardQueue.getStats()
      });
    } else if (error.message.includes('timeout') || error.message.includes('too many concurrent')) {
      res.status(503).json({ 
        error: 'Server is busy processing other board requests. Please try again in a few seconds.',
        requestId: requestId,
        queueStats: boardQueue.getStats(),
        retryAfter: 10
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to generate game board',
        requestId: requestId,
        memory: Math.round(errorMemory.heapUsed / 1024 / 1024) + 'MB'
      });
    }
  } finally {
    // Force cleanup
    try {
      imageBuffer = null;
      
      // Force garbage collection in development mode
      if (global.gc && process.env.NODE_ENV !== 'production') {
        global.gc();
        const cleanupMemory = process.memoryUsage();
        console.log(`🧹 [${requestId}] Memory after cleanup: ${Math.round(cleanupMemory.heapUsed / 1024 / 1024)}MB`);
      }
      
      // Log warning if memory usage is high
      const finalMemory = process.memoryUsage();
      const memoryUsageMB = Math.round(finalMemory.heapUsed / 1024 / 1024);
      if (memoryUsageMB > 512) { // Warn if over 512MB
        console.warn(`⚠️  [${requestId}] High memory usage detected: ${memoryUsageMB}MB`);
      }
    } catch (cleanupError) {
      console.warn(`⚠️  [${requestId}] Error during cleanup:`, cleanupError.message);
    }
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
    
    // Convert snakes and ladders to Maps and calculate actual counts
    const snakesMap = new Map(Object.entries(snakes).map(([k, v]) => [k, Number(v)]));
    const laddersMap = new Map(Object.entries(ladders).map(([k, v]) => [k, Number(v)]));
    
    // Calculate actual counts from the Maps (more reliable than passed values)
    const actualSnakeCount = snakesMap.size;
    const actualLadderCount = laddersMap.size;
    
    console.log(`Game counts - Snakes: ${actualSnakeCount}, Ladders: ${actualLadderCount}`);
    
    const newGame = new Game({
      gameId,
      name,
      maxTeamSize,
      createdBy,
      applicationDeadline,
      channelId: 'dashboard-created',
      status: 'pending',
      tileTasks: new Map(Object.entries(tileTasks)),
      snakes: snakesMap,
      ladders: laddersMap,
      participants: [],
      snakeCount: actualSnakeCount,
      ladderCount: actualLadderCount
    });
    
    await newGame.save();
    console.log(`Game "${name}" created successfully with ${actualSnakeCount} snakes and ${actualLadderCount} ladders`);
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

    // Update game status to active but not officially started yet
    game.status = 'active';
    game.isOfficiallyStarted = false; // Teams cannot roll until officially started
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

    // Update game status to active but not officially started yet
    game.status = 'active';
    game.isOfficiallyStarted = false; // Teams cannot roll until officially started
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
      
      // IMPORTANT: Invalidate board cache for this game so reset positions appear immediately
      const invalidatedCount = boardQueue.invalidateGameCache(req.params.gameId);
      console.log(`🔄 Cache invalidated for game ${req.params.gameId} after game reset - ${invalidatedCount} entries removed`);
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
    
    // Get game details for state validation
    const game = await Game.findOne({ gameId: team.gameId });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Check if game is active
    if (game.status !== 'active') {
      return res.status(400).json({ error: `Game is not currently active. Status: ${game.status}` });
    }

    // Check if game is officially started
    if (!game.isOfficiallyStarted) {
      return res.status(400).json({ error: 'Game has not been officially started yet. Teams cannot roll until an admin officially starts the game.' });
    }

    // Check if game is paused
    if (game.isPaused) {
      return res.status(400).json({ error: 'Game is currently paused. Please wait for an admin to resume the game before rolling.' });
    }
    
    // Roll the dice
    const diceRoll = Math.floor(Math.random() * 6) + 1;
    const oldPosition = team.currentPosition;
    let newPosition = Math.min(oldPosition + diceRoll, 100);
    
    // Check for snakes and ladders
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

    // Check for win condition
    let gameWon = false;
    if (newPosition >= 100) {
      game.status = 'completed';
      game.completedAt = new Date();
      game.winner = team.teamId;
      await game.save();
      gameWon = true;
    }

    // IMPORTANT: Invalidate board cache for this game so position changes appear immediately
    const invalidatedCount = boardQueue.invalidateGameCache(team.gameId);
    console.log(`🔄 Cache invalidated for game ${team.gameId} after team roll - ${invalidatedCount} entries removed`);
    
    res.json({
      diceRoll,
      oldPosition,
      newPosition,
      snakeOrLadder,
      gameWon
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

// PUT endpoint to update team position
app.put('/api/teams/:teamId/position', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { newPosition } = req.body;

    // Validate position
    if (!newPosition || newPosition < 0 || newPosition > 100) {
      return res.status(400).json({ error: 'Position must be between 0 and 100' });
    }

    // Find the team
    const team = await Team.findOne({ teamId });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Update the position
    const oldPosition = team.currentPosition;
    team.currentPosition = parseInt(newPosition);
    await team.save();

    console.log(`Admin updated team ${team.teamName} position from ${oldPosition} to ${newPosition}`);
    
    res.json({ 
      team, 
      message: `Team position updated from ${oldPosition} to ${newPosition}` 
    });
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
    
    // IMPORTANT: Invalidate board cache for this game so changes appear immediately
    const invalidatedCount = boardQueue.invalidateGameCache(gameId);
    console.log(`🔄 Cache invalidated for game ${gameId} after tile update - ${invalidatedCount} entries removed`);
    
    res.json({
      message: 'Tile updated successfully',
      tile: {
        number: tileNum,
        task: currentTileTasks.get(tileKey) || null
      },
      cacheInvalidated: invalidatedCount > 0
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

    console.log(`Updating snake/ladder for tile ${tileNumber} in game ${gameId}`, { snakeEnd, ladderEnd, removeSnake, removeLadder });

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
    let snakeCountChanged = false;
    let ladderCountChanged = false;
    
    // Handle snake updates
    if (removeSnake) {
      if (game.snakes.has(tileKey)) {
        game.snakes.delete(tileKey);
        snakeCountChanged = true;
        console.log(`Removed snake from tile ${tileNum}`);
      }
    } else if (snakeEnd !== undefined && snakeEnd !== null) {
      const snakeEndNum = parseInt(snakeEnd);
      if (snakeEndNum >= 1 && snakeEndNum < tileNum) {
        const hadSnake = game.snakes.has(tileKey);
        game.snakes.set(tileKey, snakeEndNum);
        if (!hadSnake) {
          snakeCountChanged = true;
          console.log(`Added snake from tile ${tileNum} to ${snakeEndNum}`);
        } else {
          console.log(`Updated snake from tile ${tileNum} to ${snakeEndNum}`);
        }
      } else {
        return res.status(400).json({ error: 'Snake end must be less than snake start and >= 1' });
      }
    }
    
    // Handle ladder updates
    if (removeLadder) {
      if (game.ladders.has(tileKey)) {
        game.ladders.delete(tileKey);
        ladderCountChanged = true;
        console.log(`Removed ladder from tile ${tileNum}`);
      }
    } else if (ladderEnd !== undefined && ladderEnd !== null) {
      const ladderEndNum = parseInt(ladderEnd);
      if (ladderEndNum > tileNum && ladderEndNum <= 100) {
        const hadLadder = game.ladders.has(tileKey);
        game.ladders.set(tileKey, ladderEndNum);
        if (!hadLadder) {
          ladderCountChanged = true;
          console.log(`Added ladder from tile ${tileNum} to ${ladderEndNum}`);
        } else {
          console.log(`Updated ladder from tile ${tileNum} to ${ladderEndNum}`);
        }
      } else {
        return res.status(400).json({ error: 'Ladder end must be greater than ladder start and <= 100' });
      }
    }

    // Update counts based on actual Map sizes
    const newSnakeCount = game.snakes.size;
    const newLadderCount = game.ladders.size;
    
    console.log(`Snake count: ${game.snakeCount} -> ${newSnakeCount}`);
    console.log(`Ladder count: ${game.ladderCount} -> ${newLadderCount}`);
    
    game.snakeCount = newSnakeCount;
    game.ladderCount = newLadderCount;

    await game.save();
    
    // IMPORTANT: Invalidate board cache for this game so snake/ladder changes appear immediately
    const invalidatedCount = boardQueue.invalidateGameCache(gameId);
    console.log(`🔄 Cache invalidated for game ${gameId} after snake/ladder update - ${invalidatedCount} entries removed`);
    
    res.json({
      message: 'Snake/Ladder updated successfully',
      tile: {
        number: tileNum,
        hasSnake: game.snakes.has(tileKey),
        snakeEnd: game.snakes.get(tileKey) || null,
        hasLadder: game.ladders.has(tileKey),
        ladderEnd: game.ladders.get(tileKey) || null
      },
      counts: {
        snakeCount: game.snakeCount,
        ladderCount: game.ladderCount
      },
      cacheInvalidated: invalidatedCount > 0
    });
  } catch (error) {
    console.error('Error updating snake/ladder:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT endpoint to update announcement channel for a game
app.put('/api/games/:gameId/channel', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { announcementChannelId } = req.body;

    const game = await Game.findOne({ gameId });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (announcementChannelId !== undefined) {
      game.announcementChannelId = announcementChannelId;
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

// Board generation queue status endpoint
app.get("/api/queue-status", (req, res) => {
  const stats = boardQueue.getStats();
  const memoryUsage = process.memoryUsage();
  
  res.json({
    status: "OK",
    queue: stats,
    memory: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
      rss: Math.round(memoryUsage.rss / 1024 / 1024)
    },
    uptime: process.uptime()
  });
});

// Manual cache invalidation endpoints (for debugging/admin purposes)
app.post("/api/games/:gameId/invalidate-cache", (req, res) => {
  const { gameId } = req.params;
  const invalidatedCount = boardQueue.invalidateGameCache(gameId);
  
  res.json({
    message: `Cache invalidated for game ${gameId}`,
    invalidatedEntries: invalidatedCount,
    remainingCacheSize: boardQueue.getStats().cacheSize
  });
});

app.post("/api/cache/clear-all", (req, res) => {
  const invalidatedCount = boardQueue.invalidateAllCache();
  
  res.json({
    message: "All cache cleared",
    invalidatedEntries: invalidatedCount,
    remainingCacheSize: boardQueue.getStats().cacheSize
  });
});

// Game state management endpoints
app.post('/api/games/:gameId/official-start', async (req, res) => {
  try {
    const game = await Game.findOne({ gameId: req.params.gameId });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.status !== 'active') {
      return res.status(400).json({ error: 'Game must be active to officially start' });
    }

    if (game.isOfficiallyStarted) {
      return res.status(400).json({ error: 'Game is already officially started' });
    }

    game.isOfficiallyStarted = true;
    await game.save();

    // Invalidate cache to reflect game state change
    boardQueue.invalidateGameCache(req.params.gameId);

    res.json({ 
      success: true, 
      message: 'Game officially started - teams can now roll', 
      game 
    });
  } catch (error) {
    console.error('Error officially starting game:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/games/:gameId/pause', async (req, res) => {
  try {
    const game = await Game.findOne({ gameId: req.params.gameId });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.status !== 'active') {
      return res.status(400).json({ error: 'Only active games can be paused' });
    }

    game.isPaused = true;
    await game.save();

    // Invalidate cache to reflect game state change
    boardQueue.invalidateGameCache(req.params.gameId);

    res.json({ 
      success: true, 
      message: 'Game paused - teams cannot roll until resumed', 
      game 
    });
  } catch (error) {
    console.error('Error pausing game:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/games/:gameId/resume', async (req, res) => {
  try {
    const game = await Game.findOne({ gameId: req.params.gameId });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.status !== 'active') {
      return res.status(400).json({ error: 'Only active games can be resumed' });
    }

    game.isPaused = false;
    await game.save();

    // Invalidate cache to reflect game state change
    boardQueue.invalidateGameCache(req.params.gameId);

    res.json({ 
      success: true, 
      message: 'Game resumed - teams can now roll again', 
      game 
    });
  } catch (error) {
    console.error('Error resuming game:', error);
    res.status(500).json({ error: error.message });
  }
});

// Validation functions for tile tasks and images
function validateTileTasksSize(tileTasks) {
  const maxTasksSize = 50 * 1024 * 1024; // 50MB total limit for all tile tasks
  let totalSize = 0;
  
  for (const [tileNumber, task] of Object.entries(tileTasks)) {
    if (task && (task.imageUrl || task.uploadedImageUrl)) {
      const imageUrl = task.uploadedImageUrl || task.imageUrl;
      if (imageUrl && imageUrl.startsWith('data:')) {
        // Calculate base64 size
        const base64Data = imageUrl.split(',')[1];
        if (base64Data) {
          totalSize += base64Data.length;
        }
      }
    }
  }
  
  if (totalSize > maxTasksSize) {
    throw new Error(`Total tile tasks size (${Math.round(totalSize / 1024 / 1024)}MB) exceeds limit (${Math.round(maxTasksSize / 1024 / 1024)}MB)`);
  }
  
  console.log(`✅ Tile tasks validation passed - Total size: ${Math.round(totalSize / 1024)}KB`);
}

function validateAndOptimizeImage(imageUrl, maxSizeKB = 500) {
  if (!imageUrl || !imageUrl.startsWith('data:')) {
    return; // Skip validation for non-data URLs
  }
  
  try {
    const base64Data = imageUrl.split(',')[1];
    if (!base64Data) {
      throw new Error('Invalid data URL format');
    }
    
    const sizeKB = Math.round((base64Data.length * 3) / 4 / 1024); // Base64 to bytes conversion
    
    if (sizeKB > maxSizeKB) {
      throw new Error(`Image size (${sizeKB}KB) exceeds limit (${maxSizeKB}KB). Please compress the image.`);
    }
    
    console.log(`✅ Image validation passed - Size: ${sizeKB}KB`);
  } catch (error) {
    throw new Error(`Image validation failed: ${error.message}`);
  }
}

// Memory monitoring middleware
function logMemoryUsage() {
  const usage = process.memoryUsage();
  const timestamp = new Date().toISOString();
  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
  const rssMB = Math.round(usage.rss / 1024 / 1024);
  
  console.log(`💾 [${timestamp}] Memory usage - Heap: ${heapUsedMB}MB / ${heapTotalMB}MB, RSS: ${rssMB}MB, External: ${Math.round(usage.external / 1024 / 1024)}MB`);
  
  // Emergency memory management
  if (heapUsedMB > 600) { // Emergency threshold
    console.error(`🚨 EMERGENCY: Critical memory usage: ${heapUsedMB}MB - Clearing all caches and forcing GC`);
    boardQueue.clearAll();
    
    if (global.gc) {
      global.gc();
      const afterGC = process.memoryUsage();
      console.log(`🧹 Memory after emergency GC: ${Math.round(afterGC.heapUsed / 1024 / 1024)}MB`);
    }
  } else if (heapUsedMB > 400) { // Warning threshold
    console.warn(`⚠️  High memory usage detected: ${heapUsedMB}MB - Queue stats: ${JSON.stringify(boardQueue.getStats())}`);
    
    // Clear cache if memory is high
    if (boardQueue.cache.size > 0) {
      boardQueue.cache.clear();
      console.log(`🧹 Cleared board cache due to high memory usage`);
    }
  } else if (heapUsedMB > 256) { // Monitor threshold
    console.warn(`� Elevated memory usage: ${heapUsedMB}MB - Queue: ${boardQueue.currentRequests} active, ${boardQueue.queue.length} queued`);
  }
}

// Log memory usage every 30 seconds
setInterval(logMemoryUsage, 30000);

// Force garbage collection every 2 minutes in development
if (global.gc && process.env.NODE_ENV !== 'production') {
  setInterval(() => {
    console.log('🧹 Forcing garbage collection...');
    global.gc();
    logMemoryUsage();
  }, 120000);
}

// Log initial memory usage
console.log('🚀 Server starting - Initial memory usage:');
logMemoryUsage();

app.listen(PORT, () => {
  console.log(`SNL API server running on port ${PORT}`);
});

export default app;
