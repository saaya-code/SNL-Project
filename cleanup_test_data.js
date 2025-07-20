// Cleanup test data from MongoDB
// Run with: node cleanup_test_data.js

import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/snl-game');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const cleanupTestData = async () => {
  await connectDB();
  
  // Remove test games
  const gamesResult = await mongoose.connection.db.collection('games').deleteMany({
    name: { $regex: /test/i }
  });
  console.log(`🗑️  Deleted ${gamesResult.deletedCount} test games`);
  
  // Remove test teams
  const teamsResult = await mongoose.connection.db.collection('teams').deleteMany({
    teamName: { $regex: /test/i }
  });
  console.log(`🗑️  Deleted ${teamsResult.deletedCount} test teams`);
  
  // Remove test applications
  const appsResult = await mongoose.connection.db.collection('applications').deleteMany({
    teamName: { $regex: /test/i }
  });
  console.log(`🗑️  Deleted ${appsResult.deletedCount} test applications`);
  
  await mongoose.connection.close();
  console.log('✅ Cleanup complete');
};

cleanupTestData();
