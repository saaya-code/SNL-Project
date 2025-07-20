# 🎮 Discord Commands Testing Sequence

## Quick Start Testing (5 minutes)

### Prerequisites
1. Bot is online and in your Discord server
2. You have Administrator permissions  
3. API server running on localhost:5000
4. MongoDB running and connected

### Rapid Test Sequence

**Step 1: Create Game**
```
/snlcreate name:QuickTest
```
- Click through the setup buttons quickly
- Add 1-2 snakes and ladders
- Add 1 task on tile 50
- Click "✅ Finalize Game"

**Step 2: Set Moderator & Channel**
```
/snlsetmoderator @yourself
/snlsetchannel #current-channel
```

**Step 3: Start Registration**
```
/snlstartregistration teamsize:2
```

**Step 4: Apply & Accept**
```
/snlapply teamname:TestTeam position:leader
/snlaccept @yourself
```

**Step 5: Start Game**
```
/snlstartgame
/snlofficialstart
```

**Step 6: Test Rolling**
```
/roll
```
- Should roll dice and move from tile 0
- Team should be locked after rolling

**Step 7: Test Verification**
```
/verify
```
- Should unlock team for next roll

**Step 8: Test Win Condition**
```javascript
// In MongoDB shell or directly update:
// Set team position to 99, then roll to reach 100
```

## Detailed Test Scenarios

### Snake & Ladder Testing
Configure specific snakes/ladders, then manually test:

**Snakes to configure:**
- Tile 16 → Tile 6
- Tile 47 → Tile 26  
- Tile 87 → Tile 24

**Ladders to configure:**
- Tile 9 → Tile 31
- Tile 21 → Tile 42
- Tile 71 → Tile 91

**Testing approach:**
1. Use MongoDB to set team position to tile before snake/ladder
2. Roll dice to land on snake/ladder tile
3. Verify correct movement

### Position Update Script
```javascript
// MongoDB commands to set positions for testing
use your_database_name

// Set team to tile 15 (will hit snake at 16 with roll of 1)
db.teams.updateOne(
  {teamName: "TestTeam"}, 
  {$set: {currentPosition: 15, canRoll: true}}
)

// Set team to tile 8 (will hit ladder at 9 with roll of 1)  
db.teams.updateOne(
  {teamName: "TestTeam"}, 
  {$set: {currentPosition: 8, canRoll: true}}
)

// Set team to tile 99 (will reach tile 100 with roll of 1+)
db.teams.updateOne(
  {teamName: "TestTeam"}, 
  {$set: {currentPosition: 99, canRoll: true}}
)
```

### Error Testing
1. **Try rolling when locked:** `/roll` (should fail)
2. **Try commands without permissions:** Have non-admin try `/verify`
3. **Try creating duplicate games:** `/snlcreate` twice
4. **Try joining non-existent team:** `/snlapply teamname:FakeTeam`

### Multi-Team Testing
1. Create multiple test accounts or ask friends to help
2. Create multiple teams
3. Test simultaneous rolling
4. Test team channel isolation

## Performance Testing

### Load Testing Commands
```bash
# In project root
node test_data.js  # Check DB connection
./test_setup.sh    # Run setup script
```

### Monitoring During Tests
- Watch bot console for errors
- Monitor API server logs
- Check MongoDB performance
- Watch Discord rate limits

## Debugging Tips

### Common Issues
1. **Bot offline:** Check token and permissions
2. **Commands not responding:** Check deploy.js ran successfully
3. **Database errors:** Verify MongoDB connection
4. **API errors:** Check if port 5000 is available

### Useful Debugging Commands
```bash
# Check running processes
ps aux | grep node

# Check ports
lsof -i :5000
lsof -i :27017

# MongoDB connection test
mongosh --eval "db.runCommand('ping')"

# Bot logs
cd bot && npm run dev
```

### Reset Everything
```bash
# Clean up test data
node cleanup_test_data.js

# Or manually in MongoDB
mongosh
use your_database_name
db.games.deleteMany({name: /test/i})
db.teams.deleteMany({teamName: /test/i})
db.applications.deleteMany({teamName: /test/i})
```

## Expected Behavior Summary

### Game Creation Flow
✅ Game created with pending status  
✅ Configuration interface appears  
✅ Setup completes successfully  

### Registration Flow  
✅ Registration opens for players  
✅ Applications are accepted/declined  
✅ Teams form when enough members  

### Gameplay Flow
✅ Teams start at tile 0  
✅ Dice rolls 1-6 correctly  
✅ Snakes slide teams down  
✅ Ladders boost teams up  
✅ Position caps at tile 100  
✅ Teams lock after rolling  
✅ Verification unlocks teams  

### Win Condition
✅ Reaching tile 100 shows "TILE 100 REACHED"  
✅ Verification at tile 100 triggers victory  
✅ Game status changes to completed  
✅ Winner is recorded  

This testing approach ensures all game mechanics work correctly from start to finish!
