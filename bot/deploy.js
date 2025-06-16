import { REST, Routes } from 'discord.js' 
import fs from 'node:fs';
import path from 'node:path';
import config from './config.js';
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { CLIENT_ID: clientId, GUILD_ID: guildId, BOT_TOKEN: token } = config;

const commands = [];
const foldersPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(foldersPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));

for await (const file of commandFiles) {
  const filePath = path.join(foldersPath, file);
  const fileURL = `file://${filePath.replace(/\\/g, '/')}`;
  const commandModule = await import(fileURL);

  const command = commandModule.default || commandModule; // Ensure correct access to the default export
  if (command && 'data' in command && typeof command.execute === 'function') {
    commands.push(command.data.toJSON());
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

const rest = new REST().setToken(token);

(async () => {
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		const data = await rest.put(
			Routes.applicationGuildCommands(clientId, guildId),
			{ body: commands },
		);

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		console.error(error);
	}
})();