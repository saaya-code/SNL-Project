import mongoose from 'mongoose';

const TeamSchema = new mongoose.Schema({
  teamId: { type: String, required: true, unique: true },
  gameId: { type: String, required: true },
  teamName: { type: String, required: true },
  members: [{ 
    userId: { type: String, required: true },
    username: { type: String, required: true },
    displayName: { type: String, required: true }
  }],
  leader: { 
    userId: { type: String, required: true },
    username: { type: String, required: true },
    displayName: { type: String, required: true }
  },
  coLeader: { 
    userId: { type: String, required: false },
    username: { type: String, required: false },
    displayName: { type: String, required: false }
  },
  channelId: { type: String, required: true },
  currentPosition: { type: Number, default: 1 },
  canRoll: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'teams'
});

// Index for faster queries
TeamSchema.index({ gameId: 1 });

const Team = mongoose.models.Team || mongoose.model('Team', TeamSchema);

export default Team;
