import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import Game from '../models/Game.js';

// Store temporary game data during creation process
export const tempGameData = new Map();

export function generateRandomSnakesAndLadders(snakeCount, ladderCount) {
  const snakes = new Map();
  const ladders = new Map();
  const usedTiles = new Set();

  // Generate snakes (higher to lower tiles)
  for (let i = 0; i < snakeCount; i++) {
    let head, tail;
    do {
      head = Math.floor(Math.random() * 90) + 10; // Tiles 10-99
      tail = Math.floor(Math.random() * (head - 1)) + 1; // Lower than head
    } while (usedTiles.has(head) || usedTiles.has(tail));
    
    snakes.set(head.toString(), tail);
    usedTiles.add(head);
    usedTiles.add(tail);
  }

  // Generate ladders (lower to higher tiles)
  for (let i = 0; i < ladderCount; i++) {
    let bottom, top;
    do {
      bottom = Math.floor(Math.random() * 80) + 1; // Tiles 1-80
      top = Math.floor(Math.random() * (99 - bottom)) + bottom + 1; // Higher than bottom, max 99
    } while (usedTiles.has(bottom) || usedTiles.has(top));
    
    ladders.set(bottom.toString(), top);
    usedTiles.add(bottom);
    usedTiles.add(top);
  }

  return { snakes, ladders };
}

export async function handleSnakesLaddersConfig(interaction) {
  const userId = interaction.customId.split('_').pop();
  
  if (interaction.user.id !== userId) {
    return await interaction.editReply({ content: 'You can only configure your own game!' });
  }

  const embed = new EmbedBuilder()
    .setTitle('🐍 Snakes & Ladders Configuration')
    .setDescription('Choose how you want to configure snakes and ladders:')
    .setColor('#ff6600');

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`random_snakes_ladders_${userId}`)
        .setLabel('🎲 Generate Randomly')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`manual_snakes_ladders_${userId}`)
        .setLabel('✏️ Configure Manually')
        .setStyle(ButtonStyle.Primary)
    );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

export async function handleRandomSnakesLadders(interaction) {
  const userId = interaction.customId.split('_').pop();
  
  if (interaction.user.id !== userId) {
    return await interaction.reply({ content: 'You can only configure your own game!', ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId(`random_config_modal_${userId}`)
    .setTitle('Random Snakes & Ladders Configuration');

  const snakeCountInput = new TextInputBuilder()
    .setCustomId('snake_count')
    .setLabel('Number of Snakes (1-15)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('5')
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(2);

  const ladderCountInput = new TextInputBuilder()
    .setCustomId('ladder_count')
    .setLabel('Number of Ladders (1-15)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('5')
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(2);

  const row1 = new ActionRowBuilder().addComponents(snakeCountInput);
  const row2 = new ActionRowBuilder().addComponents(ladderCountInput);

  modal.addComponents(row1, row2);
  await interaction.showModal(modal);
}

export async function handleManualSnakesLadders(interaction) {
  const userId = interaction.customId.split('_').pop();
  
  if (interaction.user.id !== userId) {
    return await interaction.reply({ content: 'You can only configure your own game!', ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId(`manual_config_modal_${userId}`)
    .setTitle('Manual Snakes & Ladders Configuration');

  const snakesInput = new TextInputBuilder()
    .setCustomId('snakes_config')
    .setLabel('Snakes (format: head1:tail1,head2:tail2)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('16:6,47:26,49:11,56:53,62:19,64:60,87:24,93:73,95:75,98:78')
    .setRequired(false)
    .setMaxLength(1000);

  const laddersInput = new TextInputBuilder()
    .setCustomId('ladders_config')
    .setLabel('Ladders (format: bottom1:top1,bottom2:top2)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('1:38,4:14,9:31,21:42,28:84,36:44,51:67,71:91,80:100')
    .setRequired(false)
    .setMaxLength(1000);

  const row1 = new ActionRowBuilder().addComponents(snakesInput);
  const row2 = new ActionRowBuilder().addComponents(laddersInput);

  modal.addComponents(row1, row2);
  await interaction.showModal(modal);
}

export async function handleSetDeadline(interaction) {
  const userId = interaction.customId.split('_').pop();
  
  if (interaction.user.id !== userId) {
    return await interaction.reply({ content: 'You can only configure your own game!', ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId(`deadline_modal_${userId}`)
    .setTitle('Set Application Deadline');

  const deadlineInput = new TextInputBuilder()
    .setCustomId('deadline')
    .setLabel('Deadline (YYYY-MM-DD HH:MM)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('2025-12-31 23:59')
    .setRequired(true)
    .setMaxLength(16);

  const row = new ActionRowBuilder().addComponents(deadlineInput);
  modal.addComponents(row);
  await interaction.showModal(modal);
}

export async function handleRandomConfigModal(interaction) {
  const userId = interaction.customId.split('_').pop();
  
  if (interaction.user.id !== userId) {
    return await interaction.editReply({ content: 'You can only configure your own game!' });
  }

  const snakeCount = parseInt(interaction.fields.getTextInputValue('snake_count'));
  const ladderCount = parseInt(interaction.fields.getTextInputValue('ladder_count'));

  if (isNaN(snakeCount) || snakeCount < 1 || snakeCount > 15) {
    return await interaction.editReply({ content: 'Snake count must be between 1 and 15!' });
  }

  if (isNaN(ladderCount) || ladderCount < 1 || ladderCount > 15) {
    return await interaction.editReply({ content: 'Ladder count must be between 1 and 15!' });
  }

  const gameData = tempGameData.get(userId);
  if (!gameData) {
    return await interaction.editReply({ content: 'Game session expired. Please start over.' });
  }

  const { snakes, ladders } = generateRandomSnakesAndLadders(snakeCount, ladderCount);
  
  gameData.snakes = snakes;
  gameData.ladders = ladders;
  gameData.snakeCount = snakeCount;
  gameData.ladderCount = ladderCount;
  tempGameData.set(userId, gameData);

  const embed = new EmbedBuilder()
    .setTitle('✅ Snakes & Ladders Configured')
    .setDescription(`**Snakes:** ${snakeCount} randomly generated\n**Ladders:** ${ladderCount} randomly generated`)
    .addFields(
      { name: '🐍 Snakes', value: Array.from(snakes.entries()).map(([head, tail]) => `${head}→${tail}`).join(', ') || 'None' },
      { name: '🪜 Ladders', value: Array.from(ladders.entries()).map(([bottom, top]) => `${bottom}→${top}`).join(', ') || 'None' }
    )
    .setColor('#00ff00');

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`set_deadline_${userId}`)
        .setLabel('⏰ Set Deadline')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`define_tasks_${userId}`)
        .setLabel('📝 Define Tasks')
        .setStyle(ButtonStyle.Primary)      );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

export async function handleManualConfigModal(interaction) {
  const userId = interaction.customId.split('_').pop();
  
  if (interaction.user.id !== userId) {
    return await interaction.editReply({ content: 'You can only configure your own game!' });
  }

  const snakesConfig = interaction.fields.getTextInputValue('snakes_config');
  const laddersConfig = interaction.fields.getTextInputValue('ladders_config');

  const snakes = new Map();
  const ladders = new Map();

  // Parse snakes configuration
  if (snakesConfig.trim()) {
    try {
      const snakePairs = snakesConfig.split(',');
      for (const pair of snakePairs) {
        const [head, tail] = pair.trim().split(':').map(num => parseInt(num.trim()));
        if (isNaN(head) || isNaN(tail) || head <= tail || head < 1 || head > 100 || tail < 1 || tail > 100) {
          return await interaction.editReply({ content: `Invalid snake configuration: ${pair}. Head must be greater than tail, both between 1-100.` });
        }
        snakes.set(head.toString(), tail);
      }
    } catch (error) {
      return await interaction.editReply({ content: 'Invalid snakes format. Use: head1:tail1,head2:tail2' });
    }
  }

  // Parse ladders configuration
  if (laddersConfig.trim()) {
    try {
      const ladderPairs = laddersConfig.split(',');
      for (const pair of ladderPairs) {
        const [bottom, top] = pair.trim().split(':').map(num => parseInt(num.trim()));
        if (isNaN(bottom) || isNaN(top) || bottom >= top || bottom < 1 || bottom > 100 || top < 1 || top > 100) {
          return await interaction.editReply({ content: `Invalid ladder configuration: ${pair}. Bottom must be less than top, both between 1-100.` });
        }
        ladders.set(bottom.toString(), top);
      }
    } catch (error) {
      return await interaction.editReply({ content: 'Invalid ladders format. Use: bottom1:top1,bottom2:top2' });
    }
  }

  const gameData = tempGameData.get(userId);
  if (!gameData) {
    return await interaction.editReply({ content: 'Game session expired. Please start over.' });
  }

  gameData.snakes = snakes;
  gameData.ladders = ladders;
  gameData.snakeCount = snakes.size;
  gameData.ladderCount = ladders.size;
  tempGameData.set(userId, gameData);

  const embed = new EmbedBuilder()
    .setTitle('✅ Snakes & Ladders Configured')
    .setDescription(`**Snakes:** ${snakes.size} manually configured\n**Ladders:** ${ladders.size} manually configured`)
    .addFields(
      { name: '🐍 Snakes', value: Array.from(snakes.entries()).map(([head, tail]) => `${head}→${tail}`).join(', ') || 'None' },
      { name: '🪜 Ladders', value: Array.from(ladders.entries()).map(([bottom, top]) => `${bottom}→${top}`).join(', ') || 'None' }
    )
    .setColor('#00ff00');

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`set_deadline_${userId}`)
        .setLabel('⏰ Set Deadline')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`define_tasks_${userId}`)
        .setLabel('📝 Define Tasks')
        .setStyle(ButtonStyle.Primary)      );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

export async function handleDeadlineModal(interaction) {
  const userId = interaction.customId.split('_').pop();
  
  if (interaction.user.id !== userId) {
    return await interaction.editReply({ content: 'You can only configure your own game!' });
  }

  const deadlineStr = interaction.fields.getTextInputValue('deadline');
  
  try {
    const deadline = new Date(deadlineStr);
    if (isNaN(deadline.getTime()) || deadline <= new Date()) {
      return await interaction.editReply({ content: 'Invalid deadline. Please use format YYYY-MM-DD HH:MM and ensure it\'s in the future.' });
    }

    const gameData = tempGameData.get(userId);
    if (!gameData) {
      return await interaction.editReply({ content: 'Game session expired. Please start over.' });
    }

    gameData.applicationDeadline = deadline;
    tempGameData.set(userId, gameData);

    const embed = new EmbedBuilder()
      .setTitle('✅ Deadline Set')
      .setDescription(`**Application Deadline:** ${deadline.toLocaleString()}`)
      .setColor('#00ff00');

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`define_tasks_${userId}`)
          .setLabel('📝 Define Tasks')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`finalize_game_${userId}`)
          .setLabel('🎯 Finalize Game')
          .setStyle(ButtonStyle.Success)
      );

    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (error) {
    await interaction.editReply({ content: 'Invalid date format. Please use YYYY-MM-DD HH:MM' });
  }
}

export async function handleDefineTasks(interaction) {
  const userId = interaction.customId.split('_').pop();
  
  if (interaction.user.id !== userId) {
    return await interaction.reply({ content: 'You can only configure your own game!', ephemeral: true });
  }

  const gameData = tempGameData.get(userId);
  if (!gameData) {
    return await interaction.reply({ content: 'Game session expired. Please start over.', ephemeral: true });
  }

  // Start with tile 1
  gameData.currentTaskTile = 1;
  gameData.tileTasks = gameData.tileTasks || new Map();
  tempGameData.set(userId, gameData);

  await showTaskDefinitionModal(interaction, userId, 1);
}

async function showTaskDefinitionModal(interaction, userId, tileNumber) {
  const modal = new ModalBuilder()
    .setCustomId(`task_modal_${userId}_${tileNumber}`)
    .setTitle(`Define Task for Tile ${tileNumber}`);

  const taskInput = new TextInputBuilder()
    .setCustomId('task_description')
    .setLabel(`Task for Tile ${tileNumber}`)
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Enter the task description for this tile...')
    .setRequired(true)
    .setMaxLength(1000);

  const imageInput = new TextInputBuilder()
    .setCustomId('image_url')
    .setLabel('Image URL (optional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://example.com/image.png or upload file after submitting')
    .setRequired(false)
    .setMaxLength(500);

  const row1 = new ActionRowBuilder().addComponents(taskInput);
  const row2 = new ActionRowBuilder().addComponents(imageInput);

  modal.addComponents(row1, row2);

  if (interaction.isModalSubmit()) {
    await interaction.followUp({ content: `Defining task for tile ${tileNumber}...`, ephemeral: true });
    // We'll need to create a new interaction for the modal
  } else {
    await interaction.showModal(modal);
  }
}

export async function handleTaskModal(interaction) {
  const [, , userId, tileNumber] = interaction.customId.split('_');
  const tileNum = parseInt(tileNumber);
  
  if (interaction.user.id !== userId) {
    return await interaction.editReply({ content: 'You can only configure your own game!' });
  }

  const taskDescription = interaction.fields.getTextInputValue('task_description');
  const imageUrl = interaction.fields.getTextInputValue('image_url');

  const gameData = tempGameData.get(userId);
  if (!gameData) {
    return await interaction.editReply({ content: 'Game session expired. Please start over.' });
  }

  // Save the task
  if (!gameData.tileTasks) {
    gameData.tileTasks = new Map();
  }
  
  gameData.tileTasks.set(tileNum.toString(), {
    description: taskDescription,
    imageUrl: imageUrl || null
  });

  // Set up image upload waiting for this tile
  if (!gameData.awaitingImageUpload) {
    gameData.awaitingImageUpload = new Map();
  }
  gameData.awaitingImageUpload.set(tileNum.toString(), true);

  if (tileNum < 100) {
    // Continue to next tile
    gameData.currentTaskTile = tileNum + 1;
    tempGameData.set(userId, gameData);

    const embed = new EmbedBuilder()
      .setTitle(`✅ Task ${tileNum} Saved`)
      .setDescription(`**Task:** ${taskDescription}${imageUrl ? `\n**Image URL:** ${imageUrl}` : ''}\n\n💡 **Tip:** You can now upload an image file for this tile by sending it as a message in this channel.`)
      .addFields({ name: 'Progress', value: `${tileNum}/100 tasks defined` })
      .setColor('#00ff00');

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`next_task_${userId}_${tileNum + 1}`)
          .setLabel(`Define Task ${tileNum + 1}`)
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`bulk_define_${userId}`)
          .setLabel('📝 Bulk Define Remaining')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`finalize_game_${userId}`)
          .setLabel('🎯 Finalize Game')
          .setStyle(ButtonStyle.Success)
      );

    await interaction.editReply({ embeds: [embed], components: [row] });
  } else {
    // All tasks defined
    tempGameData.set(userId, gameData);
    
    const embed = new EmbedBuilder()
      .setTitle('🎉 All Tasks Defined!')
      .setDescription('All 100 tile tasks have been configured.\n\n💡 **Tip:** You can still upload images for any tile by sending image files in this channel.')
      .addFields({ name: 'Progress', value: '100/100 tasks defined ✅' })
      .setColor('#00ff00');

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`finalize_game_${userId}`)
          .setLabel('🎯 Finalize Game')
          .setStyle(ButtonStyle.Success)
      );

    await interaction.editReply({ embeds: [embed], components: [row] });
  }
}

export async function handleNextTask(interaction) {
  const [, , userId, tileNumber] = interaction.customId.split('_');
  const tileNum = parseInt(tileNumber);
  
  if (interaction.user.id !== userId) {
    return await interaction.reply({ content: 'You can only configure your own game!', ephemeral: true });
  }

  await showTaskDefinitionModal(interaction, userId, tileNum);
}

export async function handleBulkDefine(interaction) {
  const userId = interaction.customId.split('_').pop();
  
  if (interaction.user.id !== userId) {
    return await interaction.reply({ content: 'You can only configure your own game!', ephemeral: true });
  }

  const gameData = tempGameData.get(userId);
  if (!gameData) {
    return await interaction.reply({ content: 'Game session expired. Please start over.', ephemeral: true });
  }

  const currentTile = gameData.currentTaskTile || 1;
  const remainingTiles = 100 - currentTile + 1;

  const modal = new ModalBuilder()
    .setCustomId(`bulk_tasks_modal_${userId}`)
    .setTitle(`Bulk Define Tasks (${currentTile}-100)`);

  const bulkTasksInput = new TextInputBuilder()
    .setCustomId('bulk_tasks')
    .setLabel(`Tasks for tiles ${currentTile}-100 (one per line)`)
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder(`Task for tile ${currentTile}\nTask for tile ${currentTile + 1}\n...`)
    .setRequired(true)
    .setMaxLength(4000);

  const row = new ActionRowBuilder().addComponents(bulkTasksInput);
  modal.addComponents(row);
  await interaction.showModal(modal);
}

export async function handleBulkTasksModal(interaction) {
  const userId = interaction.customId.split('_').pop();
  
  if (interaction.user.id !== userId) {
    return await interaction.editReply({ content: 'You can only configure your own game!' });
  }

  const bulkTasks = interaction.fields.getTextInputValue('bulk_tasks');
  const tasks = bulkTasks.split('\n').filter(task => task.trim());

  const gameData = tempGameData.get(userId);
  if (!gameData) {
    return await interaction.editReply({ content: 'Game session expired. Please start over.' });
  }

  const currentTile = gameData.currentTaskTile || 1;
  const remainingTiles = 100 - currentTile + 1;

  if (tasks.length !== remainingTiles) {
    return await interaction.editReply({ 
      content: `Expected ${remainingTiles} tasks (for tiles ${currentTile}-100), but got ${tasks.length}. Please provide exactly one task per line.`
    });
  }

  // Save all tasks
  if (!gameData.tileTasks) {
    gameData.tileTasks = new Map();
  }

  for (let i = 0; i < tasks.length; i++) {
    const tileNum = currentTile + i;
    gameData.tileTasks.set(tileNum.toString(), {
      description: tasks[i].trim(),
      imageUrl: null
    });
  }

  gameData.currentTaskTile = 101; // All tasks completed
  tempGameData.set(userId, gameData);

  const embed = new EmbedBuilder()
    .setTitle('🎉 All Tasks Defined!')
    .setDescription(`Successfully defined ${tasks.length} tasks for tiles ${currentTile}-100.`)
    .addFields({ name: 'Progress', value: '100/100 tasks defined ✅' })
    .setColor('#00ff00');

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`finalize_game_${userId}`)
        .setLabel('🎯 Finalize Game')
        .setStyle(ButtonStyle.Success)      );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

export async function handleFinalizeGame(interaction) {
  const userId = interaction.customId.split('_').pop();
  
  if (interaction.user.id !== userId) {
    return await interaction.editReply({ content: 'You can only configure your own game!' });
  }

  const gameData = tempGameData.get(userId);
  if (!gameData) {
    return await interaction.editReply({ content: 'Game session expired. Please start over.' });
  }

  // Validation
  if (!gameData.tileTasks || gameData.tileTasks.size === 0) {
    return await interaction.editReply({ content: 'Please define at least some tile tasks before finalizing the game.' });
  }

  try {
    // Convert Maps to Objects for MongoDB storage
    const snakesObj = {};
    const laddersObj = {};
    const tileTasksObj = {};

    if (gameData.snakes) {
      gameData.snakes.forEach((value, key) => {
        snakesObj[key] = value;
      });
    }

    if (gameData.ladders) {
      gameData.ladders.forEach((value, key) => {
        laddersObj[key] = value;
      });
    }

    if (gameData.tileTasks) {
      gameData.tileTasks.forEach((value, key) => {
        tileTasksObj[key] = value;
      });
    }

    const newGame = new Game({
      gameId: gameData.gameId,
      name: gameData.name,
      createdBy: gameData.createdBy,
      applicationDeadline: gameData.applicationDeadline,
      snakeCount: gameData.snakeCount || 0,
      ladderCount: gameData.ladderCount || 0,
      tileTasks: tileTasksObj,
      snakes: snakesObj,
      ladders: laddersObj,
    });

    await newGame.save();
    
    // Clean up temporary data
    tempGameData.delete(userId);

    const embed = new EmbedBuilder()
      .setTitle('🎉 Game Created Successfully!')
      .setDescription(`**${gameData.name}** is ready to play!`)
      .addFields(
        { name: '🎮 Game ID', value: gameData.gameId, inline: true },
        { name: '🐍 Snakes', value: (gameData.snakeCount || 0).toString(), inline: true },
        { name: '🪜 Ladders', value: (gameData.ladderCount || 0).toString(), inline: true },
        { name: '📝 Tasks', value: `${gameData.tileTasks?.size || 0}/100`, inline: true },
        { name: '⏰ Deadline', value: gameData.applicationDeadline ? gameData.applicationDeadline.toLocaleString() : 'Not set', inline: true }
      )
      .setColor('#FFD700')
      .setFooter({ text: 'Use /snl start to begin player registration!' });

    await interaction.editReply({ embeds: [embed], components: [] });
  } catch (error) {
    console.error('Error finalizing game:', error);
    await interaction.editReply({ content: 'Failed to create the game. Please try again later.', embeds: [], components: [] });
  }
}

export async function handleImageUpload(message, tileNumber, userId) {
  const gameData = tempGameData.get(userId);
  if (!gameData || !gameData.awaitingImageUpload?.get(tileNumber.toString())) {
    return; // Not waiting for upload or session expired
  }

  if (message.attachments.size === 0) {
    await message.reply('Please attach an image file to your message.');
    return;
  }

  const attachment = message.attachments.first();
  
  // Check if it's an image
  const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!validImageTypes.includes(attachment.contentType)) {
    await message.reply('Please upload a valid image file (JPG, PNG, GIF, or WebP).');
    return;
  }

  // Check file size (Discord limit is 8MB for most servers)
  if (attachment.size > 8 * 1024 * 1024) {
    await message.reply('Image file is too large. Please upload an image smaller than 8MB.');
    return;
  }

  // Update the task with the uploaded image
  const taskData = gameData.tileTasks.get(tileNumber.toString()) || {};
  taskData.uploadedImageUrl = attachment.url;
  taskData.uploadedImageName = attachment.name;
  gameData.tileTasks.set(tileNumber.toString(), taskData);

  // Remove from awaiting upload
  gameData.awaitingImageUpload.delete(tileNumber.toString());
  tempGameData.set(userId, gameData);

  const embed = new EmbedBuilder()
    .setTitle(`✅ Image Added to Tile ${tileNumber}`)
    .setDescription(`**Task:** ${taskData.description || 'No description'}`)
    .addFields(
      { name: '📁 Uploaded Image', value: attachment.name },
      { name: '🔗 Image URL (from form)', value: taskData.imageUrl || 'None provided' }
    )
    .setImage(attachment.url)
    .setColor('#00ff00');

  await message.reply({ embeds: [embed] });
}
