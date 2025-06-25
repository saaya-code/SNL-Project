import { generateGameBoard } from './services/gameboardGenerator.js';
import fs from 'fs';

console.log('🖼️ Starting debug test...');

// Create a simple test with a data URL first (to make sure basic functionality works)
const mockGame = {
  name: 'Debug Test Game',
  status: 'active',
  snakes: new Map([
    ['16', '6']
  ]),
  ladders: new Map([
    ['1', '38']
  ]),
  tileTasks: new Map([
    ['25', { 
      name: 'Data URL Test', 
      imageUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTQwIiBoZWlnaHQ9IjE0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTQwIiBoZWlnaHQ9IjE0MCIgZmlsbD0iI0ZGNkI2QiIvPgogIDx0ZXh0IHg9IjcwIiB5PSI3NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE4IiBmaWxsPSJ3aGl0ZSI+VEVTVDwvdGV4dD4KPC9zdmc+',
      description: 'This should work with data URL!'
    }]
  ])
};

const mockTeams = [
  { teamName: 'Debug Team', currentPosition: 15 }
];

async function runTest() {
  try {
    console.log('📊 Calling generateGameBoard...');
    const buffer = await generateGameBoard(mockGame, mockTeams);
    
    console.log('💾 Writing to file...');
    fs.writeFileSync('./test-debug.png', buffer);
    
    console.log('✅ Debug test successful!');
    console.log(`📁 Saved as test-debug.png (${buffer.length} bytes)`);
    
  } catch (error) {
    console.error('❌ Debug test failed:', error.message);
    console.error(error.stack);
  }
}

runTest();
