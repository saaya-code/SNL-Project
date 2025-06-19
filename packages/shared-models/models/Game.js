import mongoose from 'mongoose';

const GameSchema = new mongoose.Schema({
  gameId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  status: { type: String, default: 'pending' },
  tileTasks: { type: Map, of: Object, default: new Map() },
  snakes: { type: Map, of: Number, default: new Map() },
  ladders: { type: Map, of: Number, default: new Map() },
  participants: { type: Array, default: [] },
  createdBy: { type: String, required: true },
  applicationDeadline: { type: Date },
  snakeCount: { type: Number, default: 0 },
  ladderCount: { type: Number, default: 0 },
  maxTeamSize: { type: Number, default: 1 }
}, {
  timestamps: true, // Adds createdAt and updatedAt fields
  collection: 'games'
});

// Ensure we don't register the model multiple times
const Game = mongoose.models.Game || mongoose.model('Game', GameSchema);

export { Game, GameSchema };
export default Game;
