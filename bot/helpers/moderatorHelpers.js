import { PermissionFlagsBits } from 'discord.js';
import GameParameters from '../models/GameParameters.js';

/**
 * Check if a user has admin or moderator permissions for SNL games
 * @param {Interaction} interaction - Discord interaction object
 * @returns {Promise<boolean>} - True if user has permissions
 */
export async function hasModeratorPermissions(interaction) {
  try {
    // Always allow Discord administrators
    if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return true;
    }

    // Check if user has the designated moderator role
    const guildId = interaction.guild.id;
    const gameParams = await GameParameters.findOne({ guildId });
    
    if (gameParams && gameParams.moderatorRoleId) {
      return interaction.member.roles.cache.has(gameParams.moderatorRoleId);
    }

    return false;
  } catch (error) {
    console.error('Error checking moderator permissions:', error);
    return false;
  }
}

/**
 * Get the moderator role for a guild
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<string|null>} - Role ID or null
 */
export async function getModeratorRole(guildId) {
  try {
    const gameParams = await GameParameters.findOne({ guildId });
    return gameParams?.moderatorRoleId || null;
  } catch (error) {
    console.error('Error getting moderator role:', error);
    return null;
  }
}

/**
 * Check if a user has permissions and send error message if not
 * @param {Interaction} interaction - Discord interaction object
 * @returns {Promise<boolean>} - True if user has permissions, false if error message was sent
 */
export async function requireModeratorPermissions(interaction) {
  const hasPermissions = await hasModeratorPermissions(interaction);
  
  if (!hasPermissions) {
    await interaction.editReply({ 
      content: '❌ You need Administrator permissions or the designated moderator role to use this command.'
    });
    return false;
  }
  
  return true;
}

/**
 * Get game parameters for a guild, creating default if needed
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<GameParameters>} - Game parameters document
 */
export async function getGameParameters(guildId) {
  try {
    let gameParams = await GameParameters.findOne({ guildId });
    if (!gameParams) {
      gameParams = new GameParameters({ guildId });
      await gameParams.save();
    }
    return gameParams;
  } catch (error) {
    console.error('Error getting game parameters:', error);
    throw error;
  }
}
