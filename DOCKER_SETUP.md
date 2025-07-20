# 🐳 Docker Development Setup

## Quick Start with Docker

### 1. Start Database Services
```bash
cd dev-infra
docker-compose up -d
```

This starts:
- **MongoDB** on `localhost:27017`
  - Username: `snl`
  - Password: `snl2025`
  - Database: `snl`
- **Mongo Express** (Web UI) on `localhost:8081`

### 2. Environment Variables

Create `.env` files for your services:

#### Bot Environment (`bot/.env`)
```env
TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_client_id
GUILD_ID=your_discord_guild_id
MONGO_URI=mongodb://snl:snl2025@localhost:27017/snl?authSource=admin
API_URL=http://localhost:5000
DEV_MODE=true
```

#### API Environment (`api/.env`)
```env
MONGODB_URI=mongodb://snl:snl2025@localhost:27017/snl?authSource=admin
PORT=5000
```

### 3. Start Application Services
```bash
# Terminal 1: Start API
cd api
npm install
npm start

# Terminal 2: Start Discord Bot
cd bot
npm install
npm run dev
```

### 4. Verify Setup
```bash
# Check all services are running
docker-compose ps                    # MongoDB + Mongo Express
curl http://localhost:5000/health    # API health check
./test_setup.sh                      # Environment checker
```

### 5. Access Database
- **Mongo Express Web UI**: http://localhost:8081
- **Direct MongoDB Connection**: `mongodb://snl:snl2025@localhost:27017/snl?authSource=admin`

## Testing with Docker Setup

### Database Management
```bash
# View data in Mongo Express
open http://localhost:8081

# Or use CLI tools with Docker credentials
node set_position.js list
node test_data.js
```

### Clean Development Reset
```bash
# Stop and remove all data
cd dev-infra
docker-compose down -v

# Start fresh
docker-compose up -d

# The bot and API will automatically connect to the fresh database
```

## Docker Commands Reference

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs mongodb
docker-compose logs mongo-express

# Stop services (keep data)
docker-compose stop

# Stop and remove data
docker-compose down -v

# Restart services
docker-compose restart

# Check status
docker-compose ps
```

## Environment Variables Explained

### Required for Bot
- `TOKEN`: Discord bot token from Discord Developer Portal
- `CLIENT_ID`: Discord application client ID
- `GUILD_ID`: Your Discord server ID (for testing)
- `MONGO_URI`: MongoDB connection string with Docker credentials

### Optional
- `DEV_MODE=true`: Enables development features (single participant games, etc.)
- `API_URL`: API server URL (defaults to localhost:5000)

## Database Structure

With Docker setup, your database will be:
- **Host**: localhost:27017
- **Database**: snl
- **Collections**: games, teams, applications, users
- **Authentication**: Required (snl/snl2025)

## Troubleshooting

### Port Conflicts
If ports 27017 or 8081 are in use:
```bash
# Check what's using the ports
lsof -i :27017
lsof -i :8081

# Stop local MongoDB if running
sudo systemctl stop mongod
```

### Connection Issues
```bash
# Test MongoDB connection
mongosh "mongodb://snl:snl2025@localhost:27017/snl?authSource=admin"

# Check Docker containers
docker-compose ps
docker-compose logs
```

### Reset Everything
```bash
# Nuclear option - removes all data
docker-compose down -v
docker system prune -f
docker-compose up -d
```

This Docker setup provides a clean, isolated development environment that's identical across different machines!
