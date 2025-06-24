# Development Mode Configuration

## Overview
The SNL (Snakes & Ladders) bot includes a development mode that allows for easier testing by reducing the minimum participant requirements for starting games.

## Environment Variable
Set `DEV_MODE=true` in your environment files to enable development mode:

### Bot (.env)
```
DEV_MODE=true
```

### API (.env)
```
DEV_MODE=true
```

### Dashboard (.env.local)
```
DEV_MODE=true
```

## Features in Development Mode

### Single Player Games
- **Normal Mode**: Requires minimum 2 participants to start a game
- **Dev Mode**: Allows games to start with just 1 participant
- Creates a single team with one player when only 1 participant is registered

### Visual Indicators
- Registration embed shows "Development mode is enabled" message
- Game start summary includes development mode note when starting with 1 participant
- Command responses include development mode context in error messages

### Team Creation Logic
- **1 Participant**: Creates 1 team with the single player as both leader and co-leader
- **2+ Participants**: Normal team distribution logic applies

## Usage for Testing

1. Set `DEV_MODE=true` in all environment files
2. Create a game with `/snlcreate`
3. Start registration with `/snlstartregistration`
4. Have one person apply using the join button
5. Accept the application with `/snlaccept`
6. Start the game with `/snlstart` - it will work with just 1 participant!

## Production Usage
Set `DEV_MODE=false` or remove the variable entirely to enforce normal participant requirements.
