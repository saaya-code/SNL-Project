import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } from 'discord.js';
import Game from '../models/Game.js';
import Application from '../models/Application.js';
import { requireModeratorPermissions } from '../helpers/moderatorHelpers.js';
import { getSingleRegistrationGame } from '../helpers/singleGameHelpers.js';

export default {
  data: new SlashCommandBuilder()
    .setName('snlaccept')
    .setDescription('Accept pending applications for the SNL game (Moderator only)'),

  async execute(interaction) {
    // Check moderator permissions
    if (!(await requireModeratorPermissions(interaction))) {
      return;
    }

    try {
      // Get the current registration game
      const game = await getSingleRegistrationGame();
      
      if (!game) {
        return await interaction.editReply({ 
          content: '❌ No game in registration status found. Create a game and start registration first.'
        });
      }

      // Get pending applications for this game
      const pendingApplications = await Application.find({
        gameId: game.gameId,
        status: 'pending'
      });

      if (pendingApplications.length === 0) {
        return await interaction.editReply({ 
          content: `📭 No pending applications found for game "${game.name}".`
        });
      }

      // Create dropdown menu for application selection
      const applicationOptions = pendingApplications
        .filter(app => app._id && (app.displayName || app.username || app.userId)) // Ensure required fields exist
        .map(app => ({
          label: app.displayName || app.username || app.userId || 'Unknown User',
          description: `Applied: ${new Date(app.appliedAt).toLocaleDateString()}`,
          value: `accept_app_${app._id}`
        }))
        .slice(0, 25); // Discord limit

      if (applicationOptions.length === 0) {
        return await interaction.editReply({ 
          content: '❌ No valid applications found to display. Applications may be missing required data.'
        });
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_application_accept')
        .setPlaceholder('Select applications to accept')
        .addOptions(applicationOptions)
        .setMinValues(1)
        .setMaxValues(Math.min(applicationOptions.length, 25));

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const embed = new EmbedBuilder()
        .setTitle(`✅ Accept Applications - ${game.name}`)
        .setDescription('Select the applications you want to accept for this game.')
        .addFields(
          { name: '📊 Pending Applications', value: `${pendingApplications.length} applications waiting for review` },
          { name: '🎮 Game Status', value: game.status }
        )
        .setColor('#00ff00')
        .setTimestamp();

      await interaction.editReply({ 
        embeds: [embed], 
        components: [row] 
      });

    } catch (error) {
      console.error('Error fetching applications:', error);
      await interaction.editReply({ 
        content: '❌ Failed to fetch applications. Please try again later.'
      });
    }
  },
};
