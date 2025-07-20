# 🎲 SNL Game Testing Guide - Complete Flow

This guide will walk you through testing the entire Snakes & Ladders game flow from creation to completion.

## 🛠️ Prerequisites

### 1. Environment Setup

#### Option A: Docker Setup (Recommended)
```bash
# Start MongoDB and Mongo Express with Docker
cd dev-infra
docker-compose up -d

# Verify services are running
docker-compose ps
```
This will start:
- MongoDB on port 27017 (credentials: snl/snl2025)
- Mongo Express web interface on port 8081

#### Option B: Local Setup
```bash
# Start MongoDB (if using local installation)
sudo systemctl start mongod

# Navigate to project directory
cd /home/saaya/snl-project

# Start API server (Terminal 1)
cd api
npm start

# Start Discord bot (Terminal 2) 
cd ../bot
npm run dev
```

### 2. Discord Setup Requirements
- Bot must be added to your Discord server with appropriate permissions
- You need Administrator permissions to use moderator commands
- Create a test channel for the game

## 📋 Complete Testing Flow

### Phase 1: Game Creation & Setup

#### Step 1: Create a New Game
```
/snlcreate name:Test Game 1
```
**Expected Result:**
- Game creation interface appears with setup options
- Board size, snakes, ladders, and task configuration buttons

#### Step 2: Configure Game Board (Interactive)
1. Click "🎯 Board Settings" button
2. Set board size (default 100 tiles)
3. Click "🐍 Configure Snakes" 
4. Add snakes (e.g., tile 16→6, tile 47→26, tile 87→24)
5. Click "🪜 Configure Ladders"
6. Add ladders (e.g., tile 9→31, tile 21→42, tile 71→91)
7. Click "📝 Configure Tasks"
8. Add tasks for specific tiles
9. Click "✅ Finalize Game" when complete

**Expected Result:**
- Game status changes to 'pending'
- Configuration saved to database

#### Step 3: Set Game Moderator
```
/snlsetmoderator @YourUsername
```
**Expected Result:**
- Your user is set as game moderator
- Confirmation message appears

#### Step 4: Set Announcement Channel
```
/snlsetchannel #announcements
```
**Expected Result:**
- Announcement channel is configured
- Game updates will post here

### Phase 2: Team Registration

#### Step 5: Start Registration
```
/snlstartregistration teamsize:3
```
**Expected Result:**
- Registration interface appears with "Join Team" button
- Registration is now open for players

#### Step 6: Test Team Applications
Have multiple users (or test accounts) apply:

**For Team Leaders:**
```
/snlapply teamname:Fire Dragons position:leader
```

**For Team Members:**
```
/snlapply teamname:Fire Dragons position:member
```

**Expected Result:**
- Applications stored in database
- Users receive confirmation messages

#### Step 7: Review Applications
```
/snlstatus
```
**Expected Result:**
- Shows all pending applications
- Team formation progress

### Phase 3: Team Management

#### Step 8: Accept/Decline Applications
```
/snlaccept @Username
/snldecline @Username
```
**Expected Result:**
- Accepted users added to teams
- Teams formed when enough members accepted

#### Step 9: Create Team Channels (Method 1)
```
/snlsetup
```
**Expected Result:**
- Creates Discord channels for teams with `channelId: 'dashboard-team'`
- Sets proper permissions for team members in guild
- Shows warning message for members not in Discord server
- Team members get access to their channels
- Welcome messages posted in team channels
- Handles mixed scenarios (some teams with channels, some without)

### Phase 4: Game Start

#### Step 10: Start Game with Teams (Method 2)
```
/snlstartgame
```
**Expected Result:**
- Creates teams from accepted applications
- Teams start at tile 0
- Game status changes to 'active'

#### Step 11: Official Game Start
```
/snlofficialstart
```
**Expected Result:**
- All teams can now roll dice
- Game officially begins

### Phase 5: Gameplay Testing

#### Step 12: Test Rolling Mechanics
In team channels (as team leader/co-leader):
```
/roll
```

**Test Cases:**
1. **Normal Roll:** Roll dice, move forward
2. **Snake Encounter:** Land on snake tile (e.g., 16, 47, 87)
3. **Ladder Encounter:** Land on ladder tile (e.g., 9, 21, 71)
4. **Task Tile:** Land on tile with task
5. **Overflow Protection:** Roll past tile 100

**Expected Results:**
- Dice roll 1-6
- Position updates correctly
- Snake/ladder mechanics work
- Position caps at tile 100
- Team locked after rolling (canRoll = false)

#### Step 13: Test Task Verification
```
/verify
```
**As Admin in team channel:**
- Verifies team's task completion
- Unlocks team for next roll

**Expected Result:**
- Team can roll again (canRoll = true)
- Verification confirmation messages

#### Step 14: Test Win Condition
Get a team to tile 100 (you can manually update database for testing):

```javascript
// In MongoDB or via API
db.teams.updateOne(
  {teamName: "Fire Dragons"}, 
  {$set: {currentPosition: 100, canRoll: false}}
)
```

Then use:
```
/verify
```

**Expected Result:**
- Team wins when verified at tile 100
- Victory messages appear
- Game status changes to 'completed'

### Phase 6: Game Management

#### Step 15: Test Game Controls
```
/snlpause    # Pause game
/snlresume   # Resume game  
/snlreset    # Reset game
/snlcleanup  # Clean up game
```

**Expected Results:**
- Game status changes appropriately
- Teams affected by status changes

## 🧪 Advanced Testing Scenarios

### Database State Testing
```bash
# Connect to MongoDB to verify data
mongosh
use your_database_name

# Check game state
db.games.find().pretty()

# Check team positions
db.teams.find({}, {teamName: 1, currentPosition: 1, canRoll: 1}).pretty()

# Check applications
db.applications.find().pretty()
```

### API Testing
```bash
# Test game board generation
curl http://localhost:5000/api/games/{gameId}/board

# Test game data
curl http://localhost:5000/api/games/{gameId}
```

### Error Condition Testing
1. **Permission Errors:** Try commands without proper permissions
2. **Invalid States:** Try rolling when locked, starting without setup
3. **Missing Data:** Try commands with non-existent games/teams
4. **Duplicate Actions:** Try creating multiple games simultaneously

## 🐛 Common Issues & Debugging

### Bot Not Responding
```bash
# Check bot logs
cd /home/saaya/snl-project/bot
npm run dev
# Look for connection errors
```

### Database Issues
```bash
# Check MongoDB status
sudo systemctl status mongod

# Check database connection
mongosh
show dbs
```

### API Issues
```bash
# Check API server
cd /home/saaya/snl-project/api
npm start
# Check for port conflicts
```

## 📊 Testing Checklist

- [ ] Game creation and configuration
- [ ] Team registration process  
- [ ] Team channel creation
- [ ] Game start mechanics
- [ ] Dice rolling and movement
- [ ] Snake mechanics (sliding down)
- [ ] Ladder mechanics (climbing up)
- [ ] Task system and verification
- [ ] Win condition at tile 100
- [ ] Game state management
- [ ] Error handling
- [ ] Multi-channel broadcasting
- [ ] Permission system

## 🎯 Performance Testing

### Load Testing
- Create multiple teams simultaneously
- Have multiple teams roll at once
- Test with maximum team sizes
- Test board image generation under load

### Edge Cases
- Empty team names
- Special characters in team names
- Very long task descriptions
- Invalid tile positions
- Network timeouts

## 📈 Monitoring & Logs

Key things to monitor during testing:
- Bot console output for errors
- API server responses
- MongoDB query performance
- Discord rate limiting
- Memory usage during image generation

This comprehensive testing approach will help you validate the entire game flow and identify any issues before production use.
