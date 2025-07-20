#!/bin/bash

# 🎲 SNL Game Testing Script
# This script helps set up and test the SNL game flow

echo "🎲 Starting SNL Game Testing Setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "bot" ] || [ ! -d "api" ]; then
    print_error "Please run this script from the SNL project root directory"
    exit 1
fi

print_status "Setting up testing environment..."

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
fi

# Check MongoDB
if ! command -v mongosh &> /dev/null; then
    print_warning "MongoDB shell (mongosh) not found. Database testing may be limited."
fi

# Function to check if a service is running on a port
check_port() {
    local port=$1
    if lsof -i:$port &> /dev/null; then
        return 0
    else
        return 1
    fi
}

echo ""
print_status "Checking services..."

# Check if API is running
if check_port 5000; then
    print_success "API server is running on port 5000"
else
    print_warning "API server is not running on port 5000"
    print_status "To start API server: cd api && npm start"
fi

# Check MongoDB
MONGODB_RUNNING=false
if check_port 27017; then
    MONGODB_RUNNING=true
    print_success "MongoDB is running on port 27017"
else
    print_warning "MongoDB is not running on port 27017"
    print_status "To start MongoDB:"
    print_status "  Local: sudo systemctl start mongod"
    print_status "  Docker: cd dev-infra && docker-compose up -d"
fi

# Check if Docker Compose is available
if command -v docker-compose &> /dev/null && [ -f "dev-infra/docker-compose.yml" ]; then
    print_status "Docker Compose available for easy setup"
    if ! $MONGODB_RUNNING; then
        print_status "Run: cd dev-infra && docker-compose up -d"
    fi
fi

echo ""
print_status "Testing Setup Complete!"
echo ""
echo "🎮 Manual Testing Steps:"
echo "1. Ensure your Discord bot is online"
echo "2. Use /snlcreate name:TestGame to start"
echo "3. Follow the TESTING_GUIDE.md for complete flow"
echo ""

# Create a simple test data script
cat > test_data.js << 'EOF'
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
EOF

print_status "Created test_data.js for database testing"
print_status "Run: node test_data.js to test database connection"

echo ""
echo "📋 Quick Test Commands:"
echo "  Discord Commands to test in order:"
echo "  1. /snlcreate name:TestGame"
echo "  2. /snlsetmoderator @yourself"
echo "  3. /snlstartregistration teamsize:3"
echo "  4. /snlapply teamname:TestTeam position:leader"
echo "  5. /snlaccept @yourself"
echo "  6. /snlstartgame"
echo "  7. /snlofficialstart"
echo "  8. /roll (in team channel)"
echo "  9. /verify (as admin)"
echo ""

# Create a database cleanup script
cat > cleanup_test_data.js << 'EOF'
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
EOF

print_status "Created cleanup_test_data.js for cleaning up test data"
print_success "Testing setup complete! See TESTING_GUIDE.md for detailed instructions."
