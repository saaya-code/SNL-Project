import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';
import Game from '../models/Game.js';
import Team from '../models/Team.js';
import Application from '../models/Application.js';
import { requireModeratorPermissions } from '../helpers/moderatorHelpers.js';
import { getSingleActiveGame, getCurrentGame } from '../helpers/singleGameHelpers.js';

export default {
  data: new SlashCommandBuilder()
    .setName('snlreset')
    .setDescription('Resets game state (Moderator only)')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('What to reset')
        .setRequired(true)
        .addChoices(
          { name: 'Reset current game', value: 'current' },
          { name: 'Reset all games and data', value: 'all' },
          { name: 'Reset team positions only', value: 'positions' },
          { name: 'Reset team roll status only', value: 'rolls' }
        )
    ),

  async execute(interaction) {
    // Check moderator permissions
    if (!(await requireModeratorPermissions(interaction))) {
      return;
    }

    const resetType = interaction.options.getString('type');

    try {
      let embed, confirmButton;

      switch (resetType) {
        case 'current':
          const currentGame = await getCurrentGame();
          if (!currentGame) {
            return await interaction.editReply({ 
              content: '📭 No current game found to reset.'
            });
          }
          
          embed = new EmbedBuilder()
            .setTitle('⚠️ Reset Current Game')
            .setDescription(`Are you sure you want to reset the current game **${currentGame.name}**?\n\nThis will:\n• Set all team positions back to tile 1\n• Allow all teams to roll again\n• Keep all game data intact`)
            .setColor('#ff9900');
          
          confirmButton = new ButtonBuilder()
            .setCustomId('confirm_reset_current')
            .setLabel('🔄 Reset Current Game')
            .setStyle(ButtonStyle.Danger);
          break;

        case 'all':
          const allGames = await Game.countDocuments();
          const allTeams = await Team.countDocuments();
          const allApps = await Application.countDocuments();
          
          embed = new EmbedBuilder()
            .setTitle('🚨 DANGER: Reset All Data')
            .setDescription(`Are you sure you want to reset **ALL** game data?\n\nThis will **PERMANENTLY DELETE**:\n• **${allGames}** games\n• **${allTeams}** teams\n• **${allApps}** applications\n• All channels will remain but be orphaned`)
            .addFields(
              { name: '⚠️ WARNING', value: 'This action cannot be undone! All game progress will be lost permanently.' }
            )
            .setColor('#ff0000');
          
          confirmButton = new ButtonBuilder()
            .setCustomId('confirm_reset_all')
            .setLabel('🗑️ DELETE ALL DATA')
            .setStyle(ButtonStyle.Danger);
          break;

        case 'positions':
          const currentGamePos = await getCurrentGame();
          if (!currentGamePos) {
            return await interaction.editReply({ 
              content: '📭 No current game found to reset positions.'
            });
          }
          
          const teams = await Team.find({ gameId: currentGamePos.gameId });
          
          embed = new EmbedBuilder()
            .setTitle('🔄 Reset Team Positions')
            .setDescription(`Reset all team positions in **${currentGamePos.name}** back to tile 1?\n\nThis will:\n• Move all **${teams.length}** teams back to tile 1\n• Keep roll status unchanged\n• Keep all other game data`)
            .setColor('#ffaa00');
          
          confirmButton = new ButtonBuilder()
            .setCustomId('confirm_reset_positions')
            .setLabel('🔄 Reset Positions')
            .setStyle(ButtonStyle.Secondary);
          break;

        case 'rolls':
          const currentGameRolls = await getCurrentGame();
          if (!currentGameRolls) {
            return await interaction.editReply({ 
              content: '📭 No current game found to reset roll status.'
            });
          }
          
          const rollTeams = await Team.find({ gameId: currentGameRolls.gameId });
          
          embed = new EmbedBuilder()
            .setTitle('🎲 Reset Roll Status')
            .setDescription(`Allow all teams in **${currentGameRolls.name}** to roll again?\n\nThis will:\n• Allow all **${rollTeams.length}** teams to use /roll\n• Keep positions unchanged\n• Keep all other game data`)
            .setColor('#0099ff');
          
          confirmButton = new ButtonBuilder()
            .setCustomId('confirm_reset_rolls')
            .setLabel('🎲 Reset Roll Status')
            .setStyle(ButtonStyle.Success);
          break;
      }

      const cancelButton = new ButtonBuilder()
        .setCustomId('cancel_reset')
        .setLabel('❌ Cancel')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder()
        .addComponents(confirmButton, cancelButton);

      await interaction.editReply({ 
        embeds: [embed], 
        components: [row] 
      });

    } catch (error) {
      console.error('Error executing snlreset command:', error);
      await interaction.editReply({ 
        content: '❌ Failed to prepare reset. Please try again later.'
      });
    }
  },
};
