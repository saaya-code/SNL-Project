import { Client, Events, GatewayIntentBits }  from 'discord.js'
import fs  from 'node:fs'
import config from './config.js'
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BOT_TOKEN = config.BOT_TOKEN;
const MONGO_URI = config.MONGO_URI;

mongoose.connect(MONGO_URI).then(() => console.log('Connected to MongoDB')).catch(err => console.error('MongoDB connection error:', err));

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers,GatewayIntentBits.MessageContent, GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildEmojisAndStickers, GatewayIntentBits.GuildIntegrations, GatewayIntentBits.GuildWebhooks, GatewayIntentBits.GuildInvites]

});

client.commands = new Map();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));

for (const file of commandFiles) {
  const foldersPath = path.join(__dirname, 'commands');
  const filePath = path.join(foldersPath, file);
  const fileURL = `file://${filePath.replace(/\\/g, '/')}`;
  let commandModule;
  try {
    commandModule = await import(fileURL);
  } catch (error) {
    console.error(`[ERROR] Failed to import ${filePath}:`, error);
    continue;
  }

  const command = commandModule.default || commandModule; // Ensure correct access to the default export
	if ('data' in command && 'execute' in command) {
		client.commands.set(command.data.name, command);
	} else {
		console.log(`[WARNING] The command at ${filePath} is missing "data" or "execute" property.`);
	}
}

// Import game creation handlers
import {
  handleSnakesLaddersConfig,
  handleRandomSnakesLadders,
  handleManualSnakesLadders,
  handleSetDeadline,
  handleRandomConfigModal,
  handleManualConfigModal,
  handleDeadlineModal,
  handleDefineTasks,
  handleTaskModal,
  handleNextTask,
  handleBulkDefine,
  handleBulkTasksModal,
  handleFinalizeGame,
  handleImageUpload,
  tempGameData
} from './helpers/gameCreationHandlers.js';

// Import registration handlers
import {
  handleJoinGame,
  handleApproveApplication,
  handleRejectApplication,
  handleRequestInfo
} from './helpers/registrationHandlers.js';

// Import application management handlers
import {
  handleSelectGameAccept,
  handleSelectGameDecline,
  handleSelectParticipantAccept,
  handleSelectParticipantDecline,
  handleConfirmAccept,
  handleConfirmDecline
} from './helpers/applicationManagementHandlers.js';

client.on(Events.InteractionCreate, async interaction => {
    try {
        if (interaction.isCommand()) {
            await interaction.deferReply(); // Defer the reply immediately
            const command = client.commands.get(interaction.commandName);
            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }
            await command.execute(interaction, client);
        } else if (interaction.isButton()) {
            const customId = interaction.customId;

            // Don't defer interactions that need to show modals
            if (customId.startsWith('random_snakes_ladders_') || 
                customId.startsWith('manual_snakes_ladders_') ||
                customId.startsWith('set_deadline_') ||
                customId.startsWith('define_tasks_') ||
                customId.startsWith('next_task_') ||
                customId.startsWith('bulk_define_') ||
                customId.startsWith('join_game_')) {
                // These handlers will show modals or create channels, so don't defer
            } else {
                await interaction.deferUpdate(); // Defer for other buttons
            }

            if (customId.startsWith('config_snakes_ladders_')) {
                await handleSnakesLaddersConfig(interaction);
            } else if (customId.startsWith('random_snakes_ladders_')) {
                await handleRandomSnakesLadders(interaction);
            } else if (customId.startsWith('manual_snakes_ladders_')) {
                await handleManualSnakesLadders(interaction);
            } else if (customId.startsWith('set_deadline_')) {
                await handleSetDeadline(interaction);
            } else if (customId.startsWith('define_tasks_')) {
                await handleDefineTasks(interaction);
            } else if (customId.startsWith('next_task_')) {
                await handleNextTask(interaction);
            } else if (customId.startsWith('bulk_define_')) {
                await handleBulkDefine(interaction);
            } else if (customId.startsWith('finalize_game_')) {
                await handleFinalizeGame(interaction);
            } else if (customId.startsWith('join_game_')) {
                await handleJoinGame(interaction);
            } else if (customId.startsWith('approve_application_')) {
                await handleApproveApplication(interaction);
            } else if (customId.startsWith('reject_application_')) {
                await handleRejectApplication(interaction);
            } else if (customId.startsWith('request_info_')) {
                await handleRequestInfo(interaction);
            }
        } else if (interaction.isStringSelectMenu()) {
            const customId = interaction.customId;

            // Don't defer select menus that show modals
            if (customId === 'select_participant_accept' || customId === 'select_participant_decline') {
                // These will show modals, so don't defer
            } else {
                await interaction.deferUpdate(); // Defer other select menu interactions
            }

            if (customId === 'select_game_accept') {
                await handleSelectGameAccept(interaction);
            } else if (customId === 'select_game_decline') {
                await handleSelectGameDecline(interaction);
            } else if (customId === 'select_participant_accept') {
                await handleSelectParticipantAccept(interaction);
            } else if (customId === 'select_participant_decline') {
                await handleSelectParticipantDecline(interaction);
            }
        } else if (interaction.isModalSubmit()) {
            await interaction.deferUpdate(); // Defer the update immediately
            const customId = interaction.customId;

            if (customId.startsWith('random_config_modal_')) {
                await handleRandomConfigModal(interaction);
            } else if (customId.startsWith('manual_config_modal_')) {
                await handleManualConfigModal(interaction);
            } else if (customId.startsWith('deadline_modal_')) {
                await handleDeadlineModal(interaction);
            } else if (customId.startsWith('task_modal_')) {
                await handleTaskModal(interaction);
            } else if (customId.startsWith('bulk_tasks_modal_')) {
                await handleBulkTasksModal(interaction);
            } else if (customId.startsWith('confirm_accept_')) {
                await handleConfirmAccept(interaction);
            } else if (customId.startsWith('confirm_decline_')) {
                await handleConfirmDecline(interaction);
            }
        }
    } catch(err) {
        console.error('Error handling interaction:', err);

        const errorResponse = { 
            content: 'There was an error while executing this interaction!', 
            flags: 64 // MessageFlags.Ephemeral
        };

        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorResponse);
            } else {
                await interaction.reply(errorResponse);
            }
        } catch (followUpError) {
            console.error('Failed to send error response:', followUpError);
        }
    }
});

// Handle message events for image uploads
client.on(Events.MessageCreate, async message => {
    // Ignore bot messages
    if (message.author.bot) return;
    
    // Check if this user is waiting for an image upload
    const gameData = tempGameData.get(message.author.id);
    if (!gameData || !gameData.awaitingImageUpload) return;
    
    // Check if user has attachments and is waiting for upload
    if (message.attachments.size > 0) {
        // Find the most recent tile they're uploading for (highest tile number waiting)
        let latestTile = null;
        let latestTileNum = 0;
        
        for (const [tileNumber, isWaiting] of gameData.awaitingImageUpload.entries()) {
            if (isWaiting) {
                const tileNum = parseInt(tileNumber);
                if (tileNum > latestTileNum) {
                    latestTileNum = tileNum;
                    latestTile = tileNumber;
                }
            }
        }
        
        if (latestTile) {
            await handleImageUpload(message, latestTile, message.author.id);
        }
    }
});


client.once(Events.ClientReady, (client) => {
    console.log(`Logged in as ${client.user.tag}!`);
});


client.login(BOT_TOKEN);