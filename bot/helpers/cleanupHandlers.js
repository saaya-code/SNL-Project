import { EmbedBuilder } from 'discord.js';
import Game from '../models/Game.js';
import Team from '../models/Team.js';
import Application from '../models/Application.js';
import { ChannelType } from 'discord.js';

// Handle game selection for cleanup
export async function handleSelectGameCleanup(interaction) {
  if (!interaction.member.permissions.has('Administrator')) {
    return await interaction.editReply({ 
      content: '❌ You need Administrator permissions to clean up game data.'
    });
  }

  const gameId = interaction.values[0].replace('cleanup_game_', '');
  
  try {
    // Get the game details
    const game = await Game.findOne({ gameId: gameId });
    if (!game) {
      return await interaction.editReply({ 
        content: '❌ Game not found.'
      });
    }

    // Perform cleanup for this specific game
    const result = await performSingleGameCleanup(interaction, game);

    const embed = new EmbedBuilder()
      .setTitle('🧹 Cleanup Complete - Single Game')
      .setDescription(`Successfully cleaned up **${game.name}**.`)
      .addFields(
        { name: '🎮 Game', value: game.name, inline: true },
        { name: '📊 Channels Deleted', value: result.totalDeleted.toString(), inline: true },
        { name: '📝 Status', value: 'All data removed', inline: true },
        { name: '⚠️ Warning', value: 'This action cannot be undone. All teams, applications, and channels have been permanently deleted.' }
      )
      .setColor('#00ff00')
      .setFooter({ text: `Cleaned by ${interaction.user.displayName}` })
      .setTimestamp();

    await interaction.editReply({ 
      embeds: [embed],
      components: []
    });

  } catch (error) {
    console.error('Error cleaning up selected game:', error);
    await interaction.editReply({ 
      content: '❌ Failed to clean up game. Please try again later.',
      components: []
    });
  }
}

// Perform cleanup for a single game
async function performSingleGameCleanup(interaction, game) {
  const guild = interaction.guild;
  let totalDeleted = 0;

  try {
    // Delete team channels and category for this game
    const teamCategory = guild.channels.cache.find(
      channel => channel.type === ChannelType.GuildCategory && 
      channel.name.toLowerCase() === `${game.name.toLowerCase()} - teams`
    );

    if (teamCategory) {
      // Delete all team channels in this category
      const teamChannels = guild.channels.cache.filter(
        channel => channel.parentId === teamCategory.id
      );

      for (const channel of teamChannels.values()) {
        try {
          await channel.delete(`SNL Cleanup - Game: ${game.name}`);
          totalDeleted++;
        } catch (error) {
          console.log(`Failed to delete team channel ${channel.name}:`, error);
        }
      }

      // Delete the category
      try {
        await teamCategory.delete(`SNL Cleanup - Game: ${game.name}`);
        totalDeleted++;
      } catch (error) {
        console.log(`Failed to delete team category for ${game.name}:`, error);
      }
    }

    // Delete application channels for this game
    const applications = await Application.find({ gameId: game.gameId });
    for (const application of applications) {
      try {
        const channel = await guild.channels.fetch(application.channelId);
        if (channel) {
          await channel.delete(`SNL Cleanup - Game: ${game.name}`);
          totalDeleted++;
        }
      } catch (error) {
        // Channel might already be deleted or not exist
        console.log(`Could not delete application channel for ${application.username}:`, error.message);
      }
    }

    // Delete database records
    await Team.deleteMany({ gameId: game.gameId });
    await Application.deleteMany({ gameId: game.gameId });
    await Game.deleteOne({ gameId: game.gameId });

    return { totalDeleted };

  } catch (error) {
    console.error(`Error cleaning up game ${game.name}:`, error);
    return { totalDeleted: 0 };
  }
}
