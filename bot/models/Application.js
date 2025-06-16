import mongoose from 'mongoose';

const ApplicationSchema = new mongoose.Schema({
  applicationId: { type: String, required: true, unique: true },
  gameId: { type: String, required: true },
  userId: { type: String, required: true },
  username: { type: String, required: true },
  displayName: { type: String, required: true },
  avatarUrl: { type: String },
  channelId: { type: String, required: true },
  status: { type: String, default: 'pending' }, // pending, accepted, rejected
  appliedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date },
  reviewedBy: { type: String },
  notes: { type: String }
}, {
  timestamps: true,
  collection: 'applications'
});

// Compound index to ensure one application per user per game
ApplicationSchema.index({ gameId: 1, userId: 1 }, { unique: true });

const Application = mongoose.models.Application || mongoose.model('Application', ApplicationSchema);

export default Application;
