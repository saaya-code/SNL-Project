import { EmbedBuilder, ChannelType } from 'discord.js';
import Game from '../models/Game.js';
import Team from '../models/Team.js';
import Application from '../models/Application.js';

export async function handleResetConfirmation(interaction) {
  const customId = interaction.customId;

  try {
    if (customId === 'cancel_reset') {
      const embed = new EmbedBuilder()
        .setTitle('❌ Reset Cancelled')
        .setDescription('No changes were made.')
        .setColor('#666666');
      
      return await interaction.editReply({ 
        embeds: [embed], 
        components: [] 
      });
    }

    switch (customId) {
      case 'confirm_reset_active':
        await resetActiveGame(interaction);
        break;
      case 'confirm_reset_all':
        await resetAllData(interaction);
        break;
      case 'confirm_reset_positions':
        await resetPositions(interaction);
        break;
      case 'confirm_reset_rolls':
        await resetRollStatus(interaction);
        break;
    }
  } catch (error) {
    console.error('Error handling reset confirmation:', error);
    await interaction.editReply({ 
      content: '❌ Failed to perform reset. Please try again later.',
      components: []
    });
  }
}

async function resetActiveGame(interaction) {
  const activeGame = await Game.findOne({ status: 'active' });
  if (!activeGame) {
    return await interaction.editReply({ 
      content: '📭 No active game found.',
      components: []
    });
  }

  // Reset all teams in the active game
  const updateResult = await Team.updateMany(
    { gameId: activeGame.gameId },
    { 
      currentPosition: 1,
      canRoll: true 
    }
  );

  const embed = new EmbedBuilder()
    .setTitle('✅ Active Game Reset Complete')
    .setDescription(`Successfully reset **${activeGame.name}**`)
    .addFields(
      { name: '🔄 Teams Reset', value: updateResult.modifiedCount.toString(), inline: true },
      { name: '📍 New Position', value: 'Tile 1', inline: true },
      { name: '🎲 Roll Status', value: 'All can roll', inline: true }
    )
    .setColor('#00ff00')
    .setTimestamp();

  await interaction.editReply({ 
    embeds: [embed], 
    components: [] 
  });
}

async function resetAllData(interaction) {
  // Count items before deletion
  const gameCount = await Game.countDocuments();
  const teamCount = await Team.countDocuments();
  const appCount = await Application.countDocuments();

  // Delete all data
  await Promise.all([
    Game.deleteMany({}),
    Team.deleteMany({}),
    Application.deleteMany({})
  ]);

  const embed = new EmbedBuilder()
    .setTitle('🗑️ All Data Reset Complete')
    .setDescription('All game data has been permanently deleted.')
    .addFields(
      { name: '🎮 Games Deleted', value: gameCount.toString(), inline: true },
      { name: '👥 Teams Deleted', value: teamCount.toString(), inline: true },
      { name: '📋 Applications Deleted', value: appCount.toString(), inline: true },
      { name: '⚠️ Note', value: 'Discord channels remain but are now orphaned. Use /snlcleanup to remove them.' }
    )
    .setColor('#ff0000')
    .setTimestamp();

  await interaction.editReply({ 
    embeds: [embed], 
    components: [] 
  });
}

async function resetPositions(interaction) {
  const activeGame = await Game.findOne({ status: 'active' });
  if (!activeGame) {
    return await interaction.editReply({ 
      content: '📭 No active game found.',
      components: []
    });
  }

  const updateResult = await Team.updateMany(
    { gameId: activeGame.gameId },
    { currentPosition: 1 }
  );

  const embed = new EmbedBuilder()
    .setTitle('🔄 Team Positions Reset')
    .setDescription(`All teams in **${activeGame.name}** moved back to tile 1`)
    .addFields(
      { name: '👥 Teams Affected', value: updateResult.modifiedCount.toString(), inline: true },
      { name: '📍 New Position', value: 'Tile 1', inline: true },
      { name: '🎲 Roll Status', value: 'Unchanged', inline: true }
    )
    .setColor('#ffaa00')
    .setTimestamp();

  await interaction.editReply({ 
    embeds: [embed], 
    components: [] 
  });
}

async function resetRollStatus(interaction) {
  const activeGame = await Game.findOne({ status: 'active' });
  if (!activeGame) {
    return await interaction.editReply({ 
      content: '📭 No active game found.',
      components: []
    });
  }

  const updateResult = await Team.updateMany(
    { gameId: activeGame.gameId },
    { canRoll: true }
  );

  const embed = new EmbedBuilder()
    .setTitle('🎲 Roll Status Reset')
    .setDescription(`All teams in **${activeGame.name}** can now roll`)
    .addFields(
      { name: '👥 Teams Affected', value: updateResult.modifiedCount.toString(), inline: true },
      { name: '🎲 Roll Status', value: 'All can roll', inline: true },
      { name: '📍 Positions', value: 'Unchanged', inline: true }
    )
    .setColor('#0099ff')
    .setTimestamp();

  await interaction.editReply({ 
    embeds: [embed], 
    components: [] 
  });
}
