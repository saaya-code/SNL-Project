// Test script for enhanced game board generation
import { generateGameBoard } from './services/gameboardGenerator.js';
import fs from 'fs';

const mockGame = {
  name: 'Enhanced Test Game',
  status: 'active',
  snakes: new Map([
    ['16', '6'], ['47', '26'], ['49', '11'], ['56', '53'], ['62', '19'], 
    ['64', '60'], ['87', '24'], ['93', '73'], ['95', '75'], ['98', '78']
  ]),
  ladders: new Map([
    ['1', '38'], ['4', '14'], ['9', '21'], ['21', '42'], ['28', '84'], 
    ['36', '44'], ['51', '67'], ['71', '91'], ['80', '100']
  ]),
  tileTasks: new Map([
    ['25', { name: 'Complete Challenge Task' }],
    ['50', { name: 'Team Building Exercise' }],
    ['75', { name: 'Final Boss Battle Challenge' }]
  ])
};

const mockTeams = [
  { teamName: 'Team Alpha', currentPosition: 15 },
  { teamName: 'Team Beta', currentPosition: 32 },
  { teamName: 'Team Gamma', currentPosition: 8 }
];

console.log('🎲 Testing enhanced game board generation...');
console.log('📐 Board size: 1400x1400 pixels');
console.log('🔲 Tile size: 140x140 pixels');
console.log('🐍 Realistic snakes with curved bodies');
console.log('🪜 Detailed ladders with wood texture');

try {
  const buffer = await generateGameBoard(mockGame, mockTeams);
  
  // Save test image
  fs.writeFileSync('./test-enhanced-board.png', buffer);
  
  console.log('✅ Enhanced board generated successfully!');
  console.log(`📁 Saved as test-enhanced-board.png (${buffer.length} bytes)`);
  console.log('🎨 Features: Larger tiles, realistic snakes, detailed ladders, enhanced styling');
  
} catch (error) {
  console.error('❌ Error generating board:', error.message);
  console.error(error.stack);
}
