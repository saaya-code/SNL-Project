# Development Mode View Switcher

## Overview
The dev mode view switcher allows developers to toggle between admin and player views during development without needing to actually have admin privileges or log in as different users.

## How to Enable
1. Set `DEV_MODE=true` in your `.env.local` file
2. Restart the Next.js development server
3. The dev mode switcher will appear in the top-right corner of the dashboard

## Features

### Visual Indicator
- **Admin View**: Shows "👑 DEV: Admin View" badge in yellow
- **Player View**: Shows "🎮 DEV: Player View" badge in green

### Switcher Controls
- **Button**: Click the "🔧 DEV" button in the top-right corner
- **Dropdown**: Select between Admin View and Player View
- **Keyboard Shortcut**: Press `Ctrl+Shift+D` to quickly toggle between views

### Persistence
- Your view preference is saved in localStorage
- The selected view persists across page reloads
- Notifications show when switching views

## Usage

### Admin View Features
- Full game management capabilities
- Create, start, pause, and delete games
- Manage teams and applications
- Access to all administrative functions

### Player View Features
- Limited to player-specific functionality
- View available games and join applications
- Submit applications to join teams
- View game status and team information

## Security Note
This switcher is **only visible in development mode** and will not appear in production builds. It's designed to help developers test both user experiences without needing multiple accounts or complex role switching.

## Keyboard Shortcuts
- `Ctrl+Shift+D`: Toggle between admin and player views

## Implementation Details
- The switcher checks `process.env.DEV_MODE === 'true'`
- View state is managed in the dashboard page component
- localStorage key: `'devModeView'`
- Supports both admin and player dashboard components
