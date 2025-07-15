# 🐍🪜--- [Features](#features)
- [Project Structure](#project-structure)tures)
- [Project Structure](#project-structure)tures)
- [Project Structure](#project-structure)adders) Discord Game Bot

A comprehensive Discord bot system for playing Snakes & Ladders games with teams, featuring a web dashboard for game management and administration.

## 📋 Table of Contents

- [Features](#features)
- `/snlcreate <name>` - Create a new game
- `/snlstartregistration` - Start game registration
- `/snlstart` - Start the game
- `/snlsetannouncement <channel>` - Set announcement channel for roll updates
- `/verify` - Verify team task completion
- `/snlaccept <user>` - Accept a player application
- `/snldecline <user>` - Decline a player applicationnds
- `/snlcreate <name>` - Create a new game
- `/snlstartregistration` - Start game registration
- `/snlstart` - Start the game
- `/snlsetannouncement <channel>` - Set announcement channel for roll updates
- `/verify` - Verify team task completion
- `/snlaccept <user>` - Accept a player application
- `/snldecline <user>` - Decline a player applicationatures)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Development Mode](#development-mode)
- [API Endpoints](#api-endpoints)
- [Discord Commands](#discord-commands)
- [Dashboard Features](#dashboard-features)
- [Advanced Tile & Board Features](#advanced-tile--board-features)
- [Live Features](#live-features)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

## ✨ Features

### 🎮 Game Features
- **Team-based Snakes & Ladders gameplay** with customizable board sizes
- **Interactive Discord bot** with slash commands
- **Custom game boards** with task assignments, images, snakes, and ladders
- **Real-time game board generation** with team positions
- **Team verification system** for task completion
- **Automatic team sorting** when games start
- **Announcement system** with Discord webhook integration
- **Pre-game team member exchange** for better balance

### 🌐 Web Dashboard
- **Admin Dashboard** for complete game management
- **Player Dashboard** for team participation
- **Discord OAuth2 authentication**
- **Real-time board visualization** with auto-refresh
- **Interactive board builder** with drag & drop functionality
- **Advanced tile editor** for individual tile customization
- **Board editor** with visual tile grid and content indicators
- **Application management system** for team joining

### 🔧 Admin Tools
- **Game creation and management**
- **Advanced tile editing** with name and image customization
- **Snake and ladder configuration** with visual editing
- **Team verification and role management**
- **Application review system**
- **Live game monitoring**
- **Board image regeneration** with optimized rendering
- **Bulk tile management** and content validation

## 📁 Project Structure

```
snl-project/
├── api/                    # Express.js API server
│   ├── models/            # MongoDB models (Game, Team, Application)
│   ├── services/          # Game logic and board generation
│   └── index.js          # Main API server
├── bot/                   # Discord bot
│   ├── commands/         # Slash commands
│   ├── helpers/          # Helper functions
│   ├── models/           # Shared models
│   └── index.js         # Bot entry point
├── dashboard/            # Next.js web dashboard
│   ├── app/             # App router pages
│   ├── components/      # React components
│   ├── lib/            # Utilities and API client
│   └── types/          # TypeScript type definitions
├── packages/
│   └── shared-models/   # Shared data models
└── dev-infra/          # Development infrastructure
    └── docker-compose.yml
```

## 🔧 Prerequisites

- **Node.js** v18+ and npm
- **MongoDB** database
- **Discord Bot Token** and Application ID
- **Discord OAuth2** credentials for web dashboard

## 🚀 Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd snl-project
```

2. **Install dependencies for all components:**
```bash
# Install API dependencies
cd api && npm install && cd ..

# Install Bot dependencies
cd bot && npm install && cd ..

# Install Dashboard dependencies
cd dashboard && npm install && cd ..

# Install shared models
cd packages/shared-models && npm install && cd ../..
```

3. **Set up MongoDB:**
   - Install MongoDB locally or use MongoDB Atlas
   - Create a database for the project

4. **Create Discord Application:**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Create a bot and get the token
   - Set up OAuth2 for the dashboard

## ⚙️ Configuration

### Environment Variables

Create `.env` files in each component directory:

#### `/api/.env`
```env
MONGO_URI=mongodb://snl:snl2025@localhost:27017/snl?authSource=admin
PORT=3000
DEV_MODE=true
```

#### `/bot/.env`
```env
DISCORD_TOKEN=your_discord_bot_token
MONGO_URI=mongodb://snl:snl2025@localhost:27017/snl?authSource=admin
APPLICATION_ID=your_discord_application_id
GUILD_ID=your_discord_guild_id
DEV_MODE=true
```

#### `/dashboard/.env.local`
```env
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your_secret_key_here
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_DEV_MODE=true
```

### Discord Bot Setup

1. **Invite the bot to your server** with the following permissions:
   - Send Messages
   - Use Slash Commands
   - Manage Channels
   - Manage Roles
   - Read Message History

2. **Deploy slash commands:**
```bash
cd bot
npm run deploy
```

## 🎯 Usage

### Starting the Services

1. **Start MongoDB** (if running locally)

2. **Start the API server:**
```bash
cd api
npm start
```

3. **Start the Discord bot:**
```bash
cd bot
npm start
```

4. **Start the web dashboard:**
```bash
cd dashboard
npm run dev
```

### Creating and Playing Games

1. **Access the admin dashboard** at `http://localhost:3001`
2. **Sign in with Discord** OAuth2
3. **Create a new game** using the interactive board builder
4. **Start registration** to allow players to apply
5. **Review applications** and accept players
6. **Start the game** to begin gameplay
7. **Players use Discord commands** to roll dice and play

## 🛠️ Development Mode

The project includes a comprehensive development mode that allows testing with minimal participants:

### Features in DEV_MODE
- **Single player games allowed** (normally requires 2+ players)
- **Visual dev mode indicators** in the dashboard
- **Relaxed validation rules** for testing
- **Auto-team creation** for single participants

### Enabling Dev Mode
Set `DEV_MODE=true` in all environment files:
- `/api/.env`
- `/bot/.env`
- `/dashboard/.env.local`

## 🔌 API Endpoints

### Games
- `GET /api/games` - List all games
- `POST /api/games` - Create a new game
- `POST /api/games/:id/start` - Start a game with team sorting
- `POST /api/games/:id/start-registration` - Start registration
- `GET /api/games/:id/board` - Get game board image
- `GET /api/games/:id/tiles/:tileNumber` - Get individual tile data
- `PUT /api/games/:id/tiles/:tileNumber` - Update individual tile

### Teams
- `GET /api/teams` - List all teams
- `POST /api/teams/:id/roll` - Roll dice for a team
- `POST /api/teams/:id/verify` - Verify team for rolling

### Applications
- `GET /api/applications` - List all applications
- `POST /api/applications/:id/accept` - Accept an application
- `POST /api/applications/:id/reject` - Reject an application

## 🤖 Discord Commands

### Player Commands
- `/apply` - Apply to join a game
- `/roll` - Roll the dice (team leaders only)
- `/status` - Check game and team status

### Admin Commands
- `/snlcreate <name>` - Create a new game
- `/snlstartregistration` - Start game registration
- `/snlstart` - Start the game
- `/verify` - Verify team task completion
- `/snlaccept <user>` - Accept a player application
- `/snldecline <user>` - Decline a player application

### Utility Commands
- `/help` - Show available commands
- `/ping` - Test bot responsiveness

## 🎨 Dashboard Features

### Admin Dashboard
- **Game Management**: Create, start, reset, delete games
- **Board Editor**: Visual tile grid with content indicators
- **Advanced Tile Editing**: Individual tile name and image customization
- **Snake & Ladder Configuration**: Visual editor for game elements
- **Team Management**: Verify teams, manage permissions, exchange team members
- **Announcement Setup**: Configure Discord channels and webhooks for roll announcements
- **Application Review**: Accept/reject player applications
- **Live Board Viewer**: Real-time game board with auto-refresh
- **Statistics Overview**: Game and player metrics

### Player Dashboard
- **My Games**: View joined games and team status
- **Available Games**: Browse and apply to open games
- **Application Status**: Track application progress
- **Board Viewer**: Watch live game progress

### Interactive Board Builder & Editor
- **10x10 grid interface** for game board creation
- **Visual tile grid** with color-coded content indicators
- **Individual tile editor** with name and image upload
- **Drag & drop image upload** for tile customization
- **Snake and ladder placement** with visual configuration
- **Task assignment** for each tile with multi-line support
- **Sample task auto-fill** functionality
- **Real-time preview** of board design
- **Image optimization** with automatic JPEG conversion
- **Content validation** and error handling

### Announcement System
- **Discord Integration**: Roll announcements sent to Discord channels
- **Bot Commands**: Direct channel posting when rolling via bot
- **Webhook Support**: Dashboard rolls use Discord webhooks
- **Rich Embeds**: Consistent formatting for all announcements
- **Game Events**: Snake/ladder events and victory announcements

## 🎨 Advanced Tile & Board Features

### Tile Editor
- **Individual Tile Customization**: Edit any tile's name and image independently
- **Image Upload & Processing**: Automatic JPEG conversion with quality optimization
- **Base64 Encoding**: Efficient image storage and transmission
- **Image Size Validation**: Prevents oversized uploads (max 1MB)
- **Transparency Handling**: PNG transparency converted to white background
- **Multi-line Text Support**: Task names wrap naturally across multiple lines

### Snake & Ladder Configuration
- **Visual Editor**: Configure snakes and ladders directly in the tile editor
- **From/To Specification**: Set source and destination tiles for each element
- **Validation**: Prevents invalid configurations (self-loops, duplicates)
- **Color Coding**: Purple for ladder bottoms, red for snake heads
- **Easy Removal**: Remove existing snakes/ladders with single click

### Board Rendering Engine
- **High-Quality SVG**: Scalable vector graphics for crisp board images
- **Optimized Layout**: Proper Snakes & Ladders numbering (bottom-left start)
- **Multi-line Text Rendering**: Automatic text wrapping and centering
- **Visual Hierarchy**: Bold task text with semi-transparent background boxes
- **Tile Numbering**: Small circles for tile numbers, separate from content
- **Image Fitting**: Images scale to fill tiles while maintaining aspect ratio
- **Memory Optimization**: Efficient image processing with usage monitoring

## 🔄 Live Features

### Auto-Refresh System
- **Board images update** automatically when teams move
- **10-second polling** for live game data
- **Cache-busting** for immediate image updates
- **Manual refresh** buttons for instant updates

### Real-time Notifications
- **Toast notifications** for all actions
- **Discord channel notifications** for team events
- **Admin alerts** for pending applications
- **Game status updates** across all interfaces

### Visual Indicators & UI Enhancements
- **Color-coded tile grid**: Visual indicators for tile content types
- **Content type legend**: Clear indication of text, image, and special tiles
- **Loading states**: Smooth loading spinners during operations
- **Error handling**: User-friendly error messages and validation
- **Responsive design**: Works on desktop and mobile devices
- **Accessibility**: Proper contrast and keyboard navigation support

## 🧪 Testing

### Manual Testing
1. **Enable DEV_MODE** in all environment files
2. **Create a test game** with minimal settings
3. **Apply as a single player** to test single-team mode
4. **Use admin commands** to verify team progression
5. **Test board refresh** by rolling dice
6. **Test tile editing** by modifying individual tiles
7. **Verify image upload** and conversion functionality
8. **Test snake/ladder configuration** in the tile editor

### Production Testing
1. **Disable DEV_MODE** in all environment files
2. **Test with multiple players** (minimum 2)
3. **Verify team sorting** works correctly
4. **Test all admin functions** with real scenarios
5. **Validate board rendering** with various tile configurations
6. **Test image optimization** and memory usage

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/new-feature`
3. **Make your changes** and test thoroughly
4. **Commit your changes**: `git commit -m 'Add new feature'`
5. **Push to the branch**: `git push origin feature/new-feature`
6. **Submit a pull request**

### Code Style
- **ESLint** for JavaScript/TypeScript linting
- **Prettier** for code formatting
- **Consistent naming** conventions
- **Comprehensive comments** for complex logic

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Discord.js** for the Discord bot framework
- **Next.js** for the web dashboard framework
- **MongoDB** for data persistence
- **Express.js** for the API server
- **NextAuth.js** for authentication
- **Tailwind CSS** for beautiful UI styling
- **Sharp** and **Canvas** for image processing and board generation

## 📞 Support

For support, please create an issue in the GitHub repository or contact the development team.

---

**Made with ❤️ by @saaya-code for the Discord gaming community**
