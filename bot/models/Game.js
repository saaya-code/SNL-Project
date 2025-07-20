import mongoose from 'mongoose';

const GameSchema = new mongoose.Schema({
  gameId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  status: { type: String, default: 'pending' }, // pending, registration, active, completed
  channelId: { type: String, required: true }, // Channel where game was created
  announcementChannelId: { type: String }, // SNL announcements channel for game updates
  submitChannelId: { type: String }, // Channel where task submissions are allowed
  pingRoleId: { type: String }, // Role to ping in announcements
  tileTasks: { type: Map, of: Object, default: new Map() }, // Now stores: { description, imageUrl, uploadedImageUrl, uploadedImageName }
  snakes: { type: Map, of: Number, default: new Map() },
  ladders: { type: Map, of: Number, default: new Map() },
  participants: { type: Array, default: [] },
  createdBy: { type: String, required: true },
  applicationDeadline: { type: Date },
  snakeCount: { type: Number, default: 0 },
  ladderCount: { type: Number, default: 0 },
  maxTeamSize: { type: Number, default: 1 },
  isOfficiallyStarted: { type: Boolean, default: false }, // Whether teams can actually roll
  isPaused: { type: Boolean, default: false }, // Whether game is paused (prevents rolling)
  channelsSetup: { type: Boolean, default: false }, // Whether team channels have been created
  winnerTeamId: { type: String }, // ID of the winning team
  completedAt: { type: Date }, // When the game was completed
}, {
  timestamps: true, // Adds createdAt and updatedAt fields
  collection: 'games'
});

const Game = mongoose.models.Game || mongoose.model('Game', GameSchema);

export default Game;
