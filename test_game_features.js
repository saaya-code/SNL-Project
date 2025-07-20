#!/usr/bin/env node

/**
 * Test Script for Snakes & Ladders Win Condition and Special Tiles
 * 
 * This script helps test:
 * 1. Win condition (reaching tile 100)
 * 2. Snakes functionality
 * 3. Ladders functionality
 * 4. Position updates via dashboard
 */

import mongoose from 'mongoose';
import Game from './api/models/Game.js';
import Team from './api/models/Team.js';
import config from './bot/config.js';

// Connect to MongoDB
const MONGO_URI = config.MONGO_URI;
await mongoose.connect(MONGO_URI);
console.log('Connected to MongoDB');

async function testWinCondition() {
  console.log('\n🏆 TESTING WIN CONDITION');
  console.log('========================');

  try {
    // Find an active game
    const activeGame = await Game.findOne({ status: 'active' });
    if (!activeGame) {
      console.log('❌ No active game found. Please start a game first.');
      return;
    }

    console.log(`Found active game: ${activeGame.name}`);

    // Find teams in this game
    const teams = await Team.find({ gameId: activeGame.gameId });
    if (teams.length === 0) {
      console.log('❌ No teams found in the active game.');
      return;
    }

    console.log(`Found ${teams.length} teams`);

    // Test with first team
    const testTeam = teams[0];
    console.log(`\nTesting with team: ${testTeam.teamName}`);
    console.log(`Current position: ${testTeam.currentPosition}`);

    // Set team to position 95 for easy win testing
    const oldPosition = testTeam.currentPosition;
    testTeam.currentPosition = 95;
    testTeam.canRoll = true; // Allow them to roll
    await testTeam.save();

    console.log(`✅ Updated ${testTeam.teamName} position from ${oldPosition} to 95`);
    console.log(`✅ Set canRoll to true`);
    console.log('\n📝 Test Instructions:');
    console.log('1. Use /roll command with this team');
    console.log('2. If you roll 5 or 6, you\'ll reach tile 100');
    console.log('3. Use /verify command to win the game');
    console.log('4. Check that game status changes to "completed"');

  } catch (error) {
    console.error('❌ Error testing win condition:', error);
  }
}

async function testSnakesAndLadders() {
  console.log('\n🐍🪜 TESTING SNAKES & LADDERS');
  console.log('============================');

  try {
    // Find an active game
    const activeGame = await Game.findOne({ status: 'active' });
    if (!activeGame) {
      console.log('❌ No active game found. Please start a game first.');
      return;
    }

    console.log(`Found active game: ${activeGame.name}`);

    // Check current snakes and ladders
    const snakes = Object.fromEntries(activeGame.snakes);
    const ladders = Object.fromEntries(activeGame.ladders);

    console.log('\nCurrent Snakes:');
    Object.entries(snakes).forEach(([start, end]) => {
      console.log(`  🐍 Tile ${start} → Tile ${end} (slide down ${start - end} tiles)`);
    });

    console.log('\nCurrent Ladders:');
    Object.entries(ladders).forEach(([start, end]) => {
      console.log(`  🪜 Tile ${start} → Tile ${end} (climb up ${end - start} tiles)`);
    });

    // Add test snakes and ladders if none exist
    if (Object.keys(snakes).length === 0 && Object.keys(ladders).length === 0) {
      console.log('\n⚠️ No snakes or ladders found. Adding test ones...');
      
      // Add some test snakes and ladders
      activeGame.snakes.set('16', 6);   // Snake: 16 → 6
      activeGame.snakes.set('47', 26);  // Snake: 47 → 26
      activeGame.snakes.set('87', 24);  // Snake: 87 → 24
      
      activeGame.ladders.set('4', 14);  // Ladder: 4 → 14
      activeGame.ladders.set('21', 42); // Ladder: 21 → 42
      activeGame.ladders.set('71', 91); // Ladder: 71 → 91
      
      await activeGame.save();
      console.log('✅ Added test snakes and ladders');
    }

    // Find teams and set them to test positions
    const teams = await Team.find({ gameId: activeGame.gameId });
    if (teams.length > 0) {
      console.log('\n🎯 Setting up teams for testing:');
      
      for (let i = 0; i < Math.min(teams.length, 3); i++) {
        const team = teams[i];
        let testPosition;
        
        if (i === 0) {
          // Set first team near a snake
          const snakePositions = Object.keys(snakes).map(Number);
          testPosition = snakePositions.length > 0 ? snakePositions[0] - 2 : 14;
        } else if (i === 1) {
          // Set second team near a ladder
          const ladderPositions = Object.keys(ladders).map(Number);
          testPosition = ladderPositions.length > 0 ? ladderPositions[0] - 2 : 2;
        } else {
          // Set third team to random position
          testPosition = 30;
        }
        
        team.currentPosition = testPosition;
        team.canRoll = true;
        await team.save();
        
        console.log(`  ✅ ${team.teamName}: Position ${testPosition} (can roll)`);
      }
    }

    console.log('\n📝 Test Instructions:');
    console.log('1. Use /roll command with different teams');
    console.log('2. Watch for snake/ladder messages when landing on special tiles');
    console.log('3. Check that positions update correctly after snake/ladder effects');
    console.log('4. Verify the announcements include snake/ladder information');

  } catch (error) {
    console.error('❌ Error testing snakes and ladders:', error);
  }
}

async function showGameStatus() {
  console.log('\n📊 CURRENT GAME STATUS');
  console.log('======================');

  try {
    const activeGame = await Game.findOne({ status: 'active' });
    if (!activeGame) {
      console.log('❌ No active game found.');
      return;
    }

    console.log(`Game: ${activeGame.name}`);
    console.log(`Status: ${activeGame.status}`);
    console.log(`Game ID: ${activeGame.gameId}`);

    const teams = await Team.find({ gameId: activeGame.gameId }).sort({ currentPosition: -1 });
    
    console.log('\nTeam Positions:');
    teams.forEach((team, index) => {
      const rank = index + 1;
      const emoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏁';
      const rollStatus = team.canRoll ? '✅ Can Roll' : '🔒 Locked';
      console.log(`  ${emoji} ${team.teamName}: Tile ${team.currentPosition} (${rollStatus})`);
    });

    // Show snakes and ladders
    const snakes = Object.fromEntries(activeGame.snakes);
    const ladders = Object.fromEntries(activeGame.ladders);
    
    if (Object.keys(snakes).length > 0) {
      console.log('\nSnakes:');
      Object.entries(snakes).forEach(([start, end]) => {
        console.log(`  🐍 ${start} → ${end}`);
      });
    }

    if (Object.keys(ladders).length > 0) {
      console.log('\nLadders:');
      Object.entries(ladders).forEach(([start, end]) => {
        console.log(`  🪜 ${start} → ${end}`);
      });
    }

  } catch (error) {
    console.error('❌ Error showing game status:', error);
  }
}

// Main execution
console.log('🎮 SNAKES & LADDERS TEST SCRIPT');
console.log('================================');

const args = process.argv.slice(2);
const command = args[0] || 'all';

switch (command) {
  case 'win':
    await testWinCondition();
    break;
  case 'snakes':
    await testSnakesAndLadders();
    break;
  case 'status':
    await showGameStatus();
    break;
  case 'all':
  default:
    await showGameStatus();
    await testSnakesAndLadders();
    await testWinCondition();
    break;
}

console.log('\n✅ Test setup complete!');
console.log('\n🎯 Quick Dashboard Test:');
console.log('1. Open the admin dashboard');
console.log('2. Go to "Position Editor" tab');
console.log('3. Try manually setting team positions');
console.log('4. Test rolling from different positions');

await mongoose.disconnect();
