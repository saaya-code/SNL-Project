import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  displayName: { type: String, required: true },
  email: { type: String },
  avatar: { type: String },
  isAdmin: { type: Boolean, default: false },
  isModerator: { type: Boolean, default: false },
  guildMember: { type: Boolean, default: false },
  permissions: {
    canManageGames: { type: Boolean, default: false },
    canManageTeams: { type: Boolean, default: false },
    canVerifyTasks: { type: Boolean, default: false }
  },
  lastLogin: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'users'
});

// Index for faster queries
UserSchema.index({ discordId: 1 });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default User;