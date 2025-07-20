// Quick test data for MongoDB
// Run with: node test_data.js

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

const testDatabaseConnection = async () => {
  await connectDB();
  
  // Test collections
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('📊 Available collections:', collections.map(c => c.name));
  
  // Close connection
  await mongoose.connection.close();
  console.log('🔌 Database connection closed');
};

testDatabaseConnection();
