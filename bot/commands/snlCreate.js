import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { v4 as uuidv4 } from 'uuid';
import Game from '../models/Game.js';
import { tempGameData } from '../helpers/gameCreationHandlers.js';



export default {
  data: new SlashCommandBuilder()
    .setName('snlcreate')
    .setDescription('Initialize a new Snakes & Ladders game')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Name of the game')
        .setRequired(true)
    ),

  async execute(interaction) {
    const name = interaction.options.getString('name');
    const gameId = uuidv4();
    
    // Store initial game data
    tempGameData.set(interaction.user.id, {
      gameId,
      name,
      createdBy: interaction.user.id,
      step: 'initial'
    });

    // Create initial setup embed
    const embed = new EmbedBuilder()
      .setTitle('🎲 Creating Snakes & Ladders Game')
      .setDescription(`**Game Name:** ${name}\n**Game ID:** ${gameId}`)
      .addFields(
        { name: '📋 Next Steps', value: '1. Configure snakes and ladders\n2. Set application deadline\n3. Define tile tasks (1-100)' }
      )
      .setColor('#00ff00');

    // Create configuration buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`config_snakes_ladders_${interaction.user.id}`)
          .setLabel('🐍 Configure Snakes & Ladders')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`set_deadline_${interaction.user.id}`)
          .setLabel('⏰ Set Deadline')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.editReply({ embeds: [embed], components: [row] });
  },
};
