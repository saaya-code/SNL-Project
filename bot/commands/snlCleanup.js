import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import Game from '../models/Game.js';
import Team from '../models/Team.js';
import Application from '../models/Application.js';

export default {
  data: new SlashCommandBuilder()
    .setName('snlcleanup')
    .setDescription('Clean up channels and data from completed SNL games (Admin only)')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('What to clean up')
        .setRequired(true)
        .addChoices(
          { name: 'Select specific game', value: 'game' },
          { name: 'Clean all completed games', value: 'all_completed' },
          { name: 'Clean application channels only', value: 'applications' },
          { name: 'Clean team channels only', value: 'teams' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    // Check if user has admin permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.editReply({ 
        content: '❌ You need Administrator permissions to clean up game data.'
      });
    }

    const action = interaction.options.getString('action');

    try {
      if (action === 'game') {
        await showGameSelectionForCleanup(interaction);
      } else if (action === 'all_completed') {
        await cleanupAllCompletedGames(interaction);
      } else if (action === 'applications') {
        await cleanupApplicationChannels(interaction);
      } else if (action === 'teams') {
        await cleanupTeamChannels(interaction);
      }
    } catch (error) {
      console.error('Error in cleanup command:', error);
      await interaction.editReply({ 
        content: '❌ Failed to process cleanup. Please try again later.'
      });
    }
  },
};

// Show game selection for cleanup
async function showGameSelectionForCleanup(interaction) {
  try {
    // Get all games
    const games = await Game.find({}).sort({ createdAt: -1 });
    
    if (games.length === 0) {
      return await interaction.editReply({ 
        content: '❌ No games found to clean up.'
      });
    }

    // Create dropdown menu for game selection
    const gameOptions = games.map(game => ({
      label: game.name,
      description: `Status: ${game.status} | Created: ${new Date(game.createdAt).toLocaleDateString()}`,
      value: `cleanup_game_${game.gameId}`
    })).slice(0, 25); // Discord limit

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_game_cleanup')
      .setPlaceholder('Select a game to clean up')
      .addOptions(gameOptions);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
      .setTitle('🧹 Game Cleanup - Select Game')
      .setDescription('Choose a game to clean up. This will delete all associated channels, teams, and applications.')
      .addFields(
        { name: '⚠️ Warning', value: 'This action cannot be undone! Make sure you want to delete all data for the selected game.' },
        { name: '📊 Available Games', value: `${games.length} games found` }
      )
      .setColor('#ff9900')
      .setTimestamp();

    await interaction.editReply({ 
      embeds: [embed], 
      components: [row] 
    });

  } catch (error) {
    console.error('Error showing game selection:', error);
    throw error;
  }
}

// Clean up all completed games
async function cleanupAllCompletedGames(interaction) {
  try {
    // Get all completed games
    const completedGames = await Game.find({ status: 'completed' });
    
    if (completedGames.length === 0) {
      return await interaction.editReply({ 
        content: '✅ No completed games found to clean up.'
      });
    }

    let totalDeleted = 0;
    const cleanupResults = [];

    for (const game of completedGames) {
      const result = await performGameCleanup(interaction, game);
      totalDeleted += result.totalDeleted;
      cleanupResults.push(`**${game.name}**: ${result.totalDeleted} channels deleted`);
    }

    const embed = new EmbedBuilder()
      .setTitle('🧹 Cleanup Complete - All Completed Games')
      .setDescription(`Successfully cleaned up ${completedGames.length} completed games.`)
      .addFields(
        { name: '📊 Summary', value: `Total channels deleted: **${totalDeleted}**` },
        { name: '🎮 Games Cleaned', value: cleanupResults.join('\n') || 'None' }
      )
      .setColor('#00ff00')
      .setFooter({ text: `Cleaned by ${interaction.user.displayName}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error cleaning up completed games:', error);
    throw error;
  }
}

// Clean up application channels
async function cleanupApplicationChannels(interaction) {
  try {
    const guild = interaction.guild;
    let deletedCount = 0;

    // Find SNL Applications category
    const applicationCategory = guild.channels.cache.find(
      channel => channel.type === ChannelType.GuildCategory && 
      channel.name.toLowerCase() === 'snl applications'
    );

    if (applicationCategory) {
      // Get all channels in the applications category
      const applicationChannels = guild.channels.cache.filter(
        channel => channel.parentId === applicationCategory.id && 
        channel.type === ChannelType.GuildText
      );

      // Delete all application channels
      for (const channel of applicationChannels.values()) {
        try {
          await channel.delete('SNL Cleanup - Application channels');
          deletedCount++;
        } catch (error) {
          console.log(`Failed to delete channel ${channel.name}:`, error);
        }
      }

      // Delete the category if it's empty
      if (applicationCategory.children.cache.size === 0) {
        try {
          await applicationCategory.delete('SNL Cleanup - Empty applications category');
          deletedCount++;
        } catch (error) {
          console.log('Failed to delete applications category:', error);
        }
      }
    }

    // Clean up application database records
    await Application.deleteMany({});

    const embed = new EmbedBuilder()
      .setTitle('🧹 Cleanup Complete - Application Channels')
      .setDescription('Successfully cleaned up all application channels and data.')
      .addFields(
        { name: '📊 Channels Deleted', value: deletedCount.toString(), inline: true },
        { name: '📝 Database Records', value: 'All applications deleted', inline: true }
      )
      .setColor('#00ff00')
      .setFooter({ text: `Cleaned by ${interaction.user.displayName}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error cleaning up application channels:', error);
    throw error;
  }
}

// Clean up team channels
async function cleanupTeamChannels(interaction) {
  try {
    const guild = interaction.guild;
    let deletedCount = 0;
    const deletedCategories = [];

    // Find all game team categories
    const teamCategories = guild.channels.cache.filter(
      channel => channel.type === ChannelType.GuildCategory && 
      channel.name.toLowerCase().includes('teams')
    );

    for (const category of teamCategories.values()) {
      // Get all channels in this team category
      const teamChannels = guild.channels.cache.filter(
        channel => channel.parentId === category.id && 
        channel.type === ChannelType.GuildText
      );

      // Delete all team channels
      for (const channel of teamChannels.values()) {
        try {
          await channel.delete('SNL Cleanup - Team channels');
          deletedCount++;
        } catch (error) {
          console.log(`Failed to delete channel ${channel.name}:`, error);
        }
      }

      // Delete the category
      try {
        await category.delete('SNL Cleanup - Team category');
        deletedCategories.push(category.name);
        deletedCount++;
      } catch (error) {
        console.log(`Failed to delete category ${category.name}:`, error);
      }
    }

    // Clean up team database records
    await Team.deleteMany({});

    const embed = new EmbedBuilder()
      .setTitle('🧹 Cleanup Complete - Team Channels')
      .setDescription('Successfully cleaned up all team channels and data.')
      .addFields(
        { name: '📊 Channels Deleted', value: deletedCount.toString(), inline: true },
        { name: '📁 Categories Deleted', value: deletedCategories.length.toString(), inline: true },
        { name: '📝 Database Records', value: 'All teams deleted', inline: true }
      )
      .setColor('#00ff00')
      .setFooter({ text: `Cleaned by ${interaction.user.displayName}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error cleaning up team channels:', error);
    throw error;
  }
}

// Perform cleanup for a specific game
async function performGameCleanup(interaction, game) {
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
        console.log(`Failed to delete application channel for ${application.username}:`, error);
      }
    }

    // Delete database records
    await Team.deleteMany({ gameId: game.gameId });
    await Application.deleteMany({ gameId: game.gameId });
    await Game.deleteOne({ gameId: game.gameId });

    return { totalDeleted };

  } catch (error) {
    console.error(`Error cleaning up game ${game.name}:`, error);
    return { totalDeleted };
  }
}
