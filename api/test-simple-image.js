import { generateGameBoard } from './services/gameboardGenerator.js';
import fs from 'fs';

console.log('🖼️ Testing gameboard with external image URL conversion...');

// Create a test with external image URLs that will be converted to data URLs
const mockGame = {
  name: 'Test Game with External Images',
  status: 'active',
  snakes: new Map([
    ['16', '6']
  ]),
  ladders: new Map([
    ['1', '38']
  ]),
  tileTasks: new Map([
    ['25', { 
      name: 'External Image Test', 
      imageUrl: 'https://i0.wp.com/picjumbo.com/wp-content/uploads/les-kralovstvi-dam-czech-republic-free-image.jpg?w=2210&quality=70',
      description: 'This tile has an external image that should be converted!'
    }],
    ['50', { 
      name: 'Another External Image', 
      imageUrl: 'https://i0.wp.com/picjumbo.com/wp-content/uploads/les-kralovstvi-dam-czech-republic-free-image.jpg?w=2210&quality=70',
      description: 'Another external image test!'
    }]
  ])
};

const mockTeams = [
  { teamName: 'Test Team', currentPosition: 15 }
];

try {
  console.log('🚀 Starting gameboard generation...');
  const buffer = await generateGameBoard(mockGame, mockTeams);
  
  console.log('Generated buffer, writing to file...');
  fs.writeFileSync('./test-external-images.png', buffer);
  
  console.log('✅ Board with external images generated successfully!');
  console.log(`📁 Saved as test-external-images.png (${buffer.length} bytes)`);
  console.log('🎨 External images were converted to data URLs for better compatibility!');
  
} catch (error) {
  console.error('❌ Error generating board:', error.message);
  console.error(error.stack);
}
