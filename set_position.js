#!/usr/bin/env node

// 🎲 SNL Position Setter - Quick testing tool
// Sets team positions for testing snakes, ladders, and win conditions

import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database connection
const connectDB = async () => {
  try {
    // Try Docker setup first, then fall back to local
    const mongoURI = process.env.MONGODB_URI || 
                     'mongodb://snl:snl2025@localhost:27017/snl?authSource=admin' ||
                     'mongodb://localhost:27017/snl-game';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Get command line arguments
const args = process.argv.slice(2);

const showUsage = () => {
  console.log(`
🎲 SNL Position Setter Usage:

  node set_position.js <teamName> <position>
  node set_position.js <teamName> <position> <canRoll>

Examples:
  node set_position.js "TestTeam" 15        # Set team to tile 15
  node set_position.js "TestTeam" 99 true   # Set team to tile 99 and allow rolling
  node set_position.js "TestTeam" 8         # Set team to tile 8 (hits ladder at 9)
  node set_position.js "TestTeam" 46        # Set team to tile 46 (hits snake at 47)

Special positions for testing:
  - Tile 8: Will hit ladder at 9 with roll of 1
  - Tile 15: Will hit snake at 16 with roll of 1  
  - Tile 46: Will hit snake at 47 with roll of 1
  - Tile 70: Will hit ladder at 71 with roll of 1
  - Tile 86: Will hit snake at 87 with roll of 1
  - Tile 99: Will reach tile 100 (win condition) with any roll

Other commands:
  node set_position.js list                 # List all teams
  node set_position.js reset                # Reset all teams to tile 0
  `);
};

const listTeams = async () => {
  const Team = mongoose.model('Team', new mongoose.Schema({}, { strict: false }));
  const teams = await Team.find({}, { teamName: 1, currentPosition: 1, canRoll: 1 });
  
  console.log('\n📊 Current Teams:');
  if (teams.length === 0) {
    console.log('  No teams found');
  } else {
    teams.forEach(team => {
      const rollStatus = team.canRoll ? '🎲 Can Roll' : '🔒 Locked';
      console.log(`  ${team.teamName}: Tile ${team.currentPosition} (${rollStatus})`);
    });
  }
  console.log();
};

const resetAllTeams = async () => {
  const Team = mongoose.model('Team', new mongoose.Schema({}, { strict: false }));
  const result = await Team.updateMany({}, { 
    $set: { currentPosition: 0, canRoll: true } 
  });
  console.log(`✅ Reset ${result.modifiedCount} teams to tile 0`);
};

const setTeamPosition = async (teamName, position, canRoll = true) => {
  const Team = mongoose.model('Team', new mongoose.Schema({}, { strict: false }));
  
  const team = await Team.findOneAndUpdate(
    { teamName: teamName },
    { 
      $set: { 
        currentPosition: parseInt(position),
        canRoll: canRoll
      } 
    },
    { new: true }
  );
  
  if (!team) {
    console.log(`❌ Team "${teamName}" not found`);
    return;
  }
  
  console.log(`✅ Set ${teamName} to tile ${position} (${canRoll ? 'Can Roll' : 'Locked'})`);
  
  // Give helpful hints about what to expect
  const pos = parseInt(position);
  if (pos === 8) {
    console.log('💡 Roll 1 to hit ladder at tile 9 → tile 31');
  } else if (pos === 15) {
    console.log('💡 Roll 1 to hit snake at tile 16 → tile 6');
  } else if (pos === 20) {
    console.log('💡 Roll 1 to hit ladder at tile 21 → tile 42');
  } else if (pos === 46) {
    console.log('💡 Roll 1 to hit snake at tile 47 → tile 26');
  } else if (pos === 70) {
    console.log('💡 Roll 1 to hit ladder at tile 71 → tile 91');
  } else if (pos === 86) {
    console.log('💡 Roll 1 to hit snake at tile 87 → tile 24');
  } else if (pos === 99) {
    console.log('💡 Any roll will reach tile 100 - test win condition!');
  } else if (pos >= 95) {
    console.log('💡 Close to tile 100 - test position capping');
  }
};

const main = async () => {
  if (args.length === 0) {
    showUsage();
    return;
  }
  
  await connectDB();
  
  const command = args[0].toLowerCase();
  
  if (command === 'list') {
    await listTeams();
  } else if (command === 'reset') {
    await resetAllTeams();
  } else if (args.length >= 2) {
    const teamName = args[0];
    const position = args[1];
    const canRoll = args[2] !== undefined ? args[2].toLowerCase() === 'true' : true;
    
    if (isNaN(position) || position < 0 || position > 100) {
      console.log('❌ Position must be a number between 0 and 100');
      await mongoose.connection.close();
      return;
    }
    
    await setTeamPosition(teamName, position, canRoll);
  } else {
    showUsage();
  }
  
  await mongoose.connection.close();
  console.log('🔌 Database connection closed');
};

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
