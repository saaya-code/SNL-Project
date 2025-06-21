import mongoose from 'mongoose';

const gameParametersSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    unique: true
  },
  moderatorRoleId: {
    type: String,
    default: null
  },
  settings: {
    allowMultipleGames: {
      type: Boolean,
      default: false
    },
    defaultGameDuration: {
      type: Number,
      default: 7 // days
    },
    maxTeamsPerGame: {
      type: Number,
      default: 10
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
gameParametersSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('GameParameters', gameParametersSchema);
