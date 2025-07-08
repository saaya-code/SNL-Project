import { EmbedBuilder } from 'discord.js';

/**
 * Send a roll announcement to the specified channel
 * @param {Client} client - Discord client
 * @param {string} channelId - Channel ID to send announcement
 * @param {Object} team - Team that rolled
 * @param {number} diceRoll - The dice roll result
 * @param {number} oldPosition - Previous position
 * @param {number} newPosition - New position
 * @param {string} snakeOrLadder - Snake or ladder effect message
 */
export async function sendRollAnnouncement(client, channelId, team, diceRoll, oldPosition, newPosition, snakeOrLadder) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      console.error(`Channel ${channelId} not found`);
      return;
    }

    // Create the announcement embed
    const embed = new EmbedBuilder()
      .setColor(newPosition === 100 ? '#FFD700' : snakeOrLadder ? (snakeOrLadder.includes('Snake') ? '#FF4444' : '#44FF44') : '#4A90E2')
      .setTitle(`🎲 ${team.teamName} Rolled!`)
      .addFields(
        { name: '🎯 Dice Roll', value: `${diceRoll}`, inline: true },
        { name: '📍 Previous Position', value: `${oldPosition}`, inline: true },
        { name: '🏃 New Position', value: `${newPosition}`, inline: true }
      );

    if (snakeOrLadder) {
      embed.addFields({ name: '🐍🪜 Special Event', value: snakeOrLadder, inline: false });
    }

    if (newPosition === 100) {
      embed.addFields({ name: '🏆 WINNER!', value: `${team.teamName} has won the game!`, inline: false });
      embed.setTitle(`🏆 ${team.teamName} WINS!`);
    }

    embed.setTimestamp();

    await channel.send({ embeds: [embed] });
    console.log(`Sent roll announcement for ${team.teamName} to channel ${channelId}`);
  } catch (error) {
    console.error('Error sending roll announcement:', error);
  }
}

/**
 * Export the client instance for use in other modules
 */
let clientInstance = null;

export function setClientInstance(client) {
  clientInstance = client;
}

export function getClientInstance() {
  return clientInstance;
}
