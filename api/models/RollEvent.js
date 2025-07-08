import mongoose from 'mongoose';

const RollEventSchema = new mongoose.Schema({
  rollId: { type: String, required: true, unique: true },
  gameId: { type: String, required: true },
  teamId: { type: String, required: true },
  teamName: { type: String, required: true },
  diceRoll: { type: Number, required: true },
  oldPosition: { type: Number, required: true },
  newPosition: { type: Number, required: true },
  snakeOrLadder: { type: String },
  rolledBy: {
    userId: { type: String, required: true },
    username: { type: String, required: true },
    displayName: { type: String, required: true }
  },
  announcementSent: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'roll_events'
});

// Index for faster queries
RollEventSchema.index({ gameId: 1, createdAt: -1 });
RollEventSchema.index({ announcementSent: 1, createdAt: -1 });

const RollEvent = mongoose.models.RollEvent || mongoose.model('RollEvent', RollEventSchema);

export default RollEvent;
