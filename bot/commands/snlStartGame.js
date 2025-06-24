import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import Game from '../models/Game.js';
import Application from '../models/Application.js';
import { requireModeratorPermissions } from '../helpers/moderatorHelpers.js';
import { getSingleRegistrationGame } from '../helpers/singleGameHelpers.js';
import { startGameWithParticipants } from '../helpers/gameStartHandlers.js';

export default {
  data: new SlashCommandBuilder()
    .setName('snlstart')
    .setDescription('Start the Snakes & Ladders game with accepted participants (Moderator only)'),

  async execute(interaction) {
    // Check moderator permissions
    if (!(await requireModeratorPermissions(interaction))) {
      return;
    }

    try {
      // Get the single registration game
      const game = await getSingleRegistrationGame();
      
      if (!game) {
        return await interaction.editReply({ 
          content: '❌ No game in registration status found. Create a game and start registration first.'
        });
      }

      // Get accepted applications for this game
      const acceptedApplications = await Application.find({ 
        gameId: game.gameId, 
        status: 'accepted' 
      });

      if (acceptedApplications.length === 0) {
        return await interaction.editReply({ 
          content: `❌ No accepted participants found for game "${game.name}". Accept some applications first.`
        });
      }

      // Check if game has required parameters set
      if (!game.maxTeamSize) {
        return await interaction.editReply({ 
          content: '❌ Game setup incomplete. Maximum team size not set. Please complete the game configuration first.'
        });
      }

      // Start the game
      await startGameWithParticipants(interaction, game.gameId);

    } catch (error) {
      console.error('Error starting game:', error);
      await interaction.editReply({ 
        content: '❌ Failed to start the game. Please try again later.'
      });
    }
  },
};
