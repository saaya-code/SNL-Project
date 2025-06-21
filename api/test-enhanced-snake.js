import { generateGameBoard } from './services/gameboardGenerator.js';
import fs from 'fs';

const mockGame = {
  name: 'Enhanced Snake Test',
  status: 'active',
  snakes: new Map([[23, 8], [56, 19], [87, 24]]),
  ladders: new Map([[4, 14], [21, 42], [71, 91]]),
  tileTasks: new Map(),
  snakeCount: 3,
  ladderCount: 3
};

const mockTeams = [
  { teamName: 'Team A', currentPosition: 15 },
  { teamName: 'Team B', currentPosition: 42 }
];

try {
  console.log('🎨 Generating enhanced game board with realistic snakes...');
  const buffer = await generateGameBoard(mockGame, mockTeams);
  
  // Save the test image
  fs.writeFileSync('./test-enhanced-snake-board.png', buffer);
  
  console.log('✅ Enhanced board generated successfully!');
  console.log('📏 Buffer size:', buffer.length, 'bytes');
  console.log('🐍 Snake improvements:');
  console.log('   • Realistic serpentine body with S-curves');
  console.log('   • Detailed snake head with golden eyes and vertical pupils');
  console.log('   • Forked red tongue extending from mouth');
  console.log('   • Scale patterns and body highlights');
  console.log('   • Natural tapering from head to tail');
  console.log('   • Shadows and depth for 3D effect');
  console.log('📄 Saved as: test-enhanced-snake-board.png');
} catch (error) {
  console.error('❌ Error generating board:', error.message);
  console.error(error.stack);
}
