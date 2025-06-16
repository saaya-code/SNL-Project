# Shared Models Package

This package contains centralized MongoDB models that are shared between the Discord bot, API server, and dashboard.

## Structure

```
packages/shared-models/
├── index.js           # Main exports
├── package.json       # Package configuration
└── models/
    └── Game.js        # Game model definition
```

## Usage

### In the Discord Bot
```javascript
import { Game } from '@snl-project/shared-models';

// Create a new game
const newGame = new Game({
  gameId: 'uuid-here',
  name: 'My Game',
  createdBy: 'user-id'
});
await newGame.save();
```

### In the API Server
```javascript
import { Game } from '@snl-project/shared-models';

// Find all games
const games = await Game.find();

// Find specific game
const game = await Game.findOne({ gameId: 'uuid-here' });
```

## Models

### Game Model
- **gameId**: Unique identifier (String, required)
- **name**: Game name (String, required) 
- **status**: Game status (String, default: 'pending')
- **tileTasks**: Map of tile numbers to task objects
- **snakes**: Map of head positions to tail positions
- **ladders**: Map of bottom positions to top positions
- **participants**: Array of participant user IDs
- **teams**: Array of team objects
- **createdBy**: Creator's user ID (String, required)
- **applicationDeadline**: Registration deadline (Date)
- **snakeCount**: Number of snakes (Number)
- **ladderCount**: Number of ladders (Number)
- **createdAt**: Auto-generated creation timestamp
- **updatedAt**: Auto-generated update timestamp

## Adding New Models

1. Create a new file in `models/` directory
2. Export the model from the file
3. Add the export to `index.js`
4. Update this README

Example:
```javascript
// models/Team.js
import mongoose from 'mongoose';

const TeamSchema = new mongoose.Schema({
  teamId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  gameId: { type: String, required: true },
  members: [{ type: String }],
  currentPosition: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export const Team = mongoose.models.Team || mongoose.model('Team', TeamSchema);
export default Team;
```

Then in `index.js`:
```javascript
export { Game } from './models/Game.js';
export { Team } from './models/Team.js';
```
