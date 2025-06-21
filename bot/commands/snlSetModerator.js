import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import GameParameters from '../models/GameParameters.js';

export default {
  data: new SlashCommandBuilder()
    .setName('snlsetmoderator')
    .setDescription('Set a role as game moderator (Admin only)')
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('The role to set as game moderator')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Action to perform')
        .setRequired(false)
        .addChoices(
          { name: 'Remove current moderator role', value: 'remove' },
          { name: 'Show current settings', value: 'show' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    // Check if user has admin permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.editReply({ 
        content: '❌ You need Administrator permissions to set game moderators.'
      });
    }

    const role = interaction.options.getRole('role');
    const action = interaction.options.getString('action');
    const guildId = interaction.guild.id;

    try {
      // Get or create game parameters for this guild
      let gameParams = await GameParameters.findOne({ guildId });
      if (!gameParams) {
        gameParams = new GameParameters({ guildId });
      }

      // Handle different actions
      if (action === 'remove') {
        const oldRoleId = gameParams.moderatorRoleId;
        gameParams.moderatorRoleId = null;
        await gameParams.save();

        const embed = new EmbedBuilder()
          .setTitle('🛡️ Moderator Role Removed')
          .setDescription('Successfully removed the game moderator role.')
          .addFields(
            { name: '📝 Previous Role', value: oldRoleId ? `<@&${oldRoleId}>` : 'None set' },
            { name: '📝 Current Role', value: 'None (Admin only)' }
          )
          .setColor('#ff9900')
          .setTimestamp();

        return await interaction.editReply({ embeds: [embed] });

      } else if (action === 'show') {
        const currentRole = gameParams.moderatorRoleId ? 
          interaction.guild.roles.cache.get(gameParams.moderatorRoleId) : null;

        const embed = new EmbedBuilder()
          .setTitle('🛡️ Current Game Moderator Settings')
          .addFields(
            { 
              name: '👑 Current Moderator Role', 
              value: currentRole ? `<@&${currentRole.id}> (${currentRole.name})` : 'None set (Admin only)',
              inline: false
            },
            {
              name: '🔧 Moderator Permissions',
              value: '• Start/stop games\n• Accept/decline participants\n• Reset game state\n• Manage teams\n• Use admin commands',
              inline: false
            },
            {
              name: '⚙️ Game Settings',
              value: `• Max teams per game: ${gameParams.settings.maxTeamsPerGame}\n• Default duration: ${gameParams.settings.defaultGameDuration} days\n• Multiple games: ${gameParams.settings.allowMultipleGames ? 'Enabled' : 'Disabled'}`,
              inline: false
            }
          )
          .setColor('#0099ff')
          .setFooter({ text: `Guild ID: ${guildId}` })
          .setTimestamp();

        return await interaction.editReply({ embeds: [embed] });

      } else if (role) {
        // Set new moderator role
        const oldRoleId = gameParams.moderatorRoleId;
        gameParams.moderatorRoleId = role.id;
        await gameParams.save();

        const embed = new EmbedBuilder()
          .setTitle('🛡️ Moderator Role Updated')
          .setDescription(`Successfully set **${role.name}** as the game moderator role.`)
          .addFields(
            { name: '📝 Previous Role', value: oldRoleId ? `<@&${oldRoleId}>` : 'None set' },
            { name: '📝 New Role', value: `<@&${role.id}>` },
            { name: '👥 Members with this role', value: `${role.members.size} members` },
            {
              name: '🎯 What this means',
              value: 'Members with this role can now:\n• Start and manage games\n• Accept/decline participants\n• Reset game state\n• Use moderator commands'
            }
          )
          .setColor('#00ff00')
          .setTimestamp();

        return await interaction.editReply({ embeds: [embed] });

      } else {
        // No role or action specified, show help
        const embed = new EmbedBuilder()
          .setTitle('🛡️ Set Game Moderator Role')
          .setDescription('Use this command to set a role as game moderator.')
          .addFields(
            {
              name: '📖 Usage',
              value: '• `/snlsetmoderator role:@RoleName` - Set moderator role\n• `/snlsetmoderator action:remove` - Remove moderator role\n• `/snlsetmoderator action:show` - Show current settings'
            },
            {
              name: '🔧 Moderator Permissions',
              value: 'Members with the moderator role can use admin-level game commands without needing Administrator Discord permissions.'
            }
          )
          .setColor('#ffaa00')
          .setTimestamp();

        return await interaction.editReply({ embeds: [embed] });
      }

    } catch (error) {
      console.error('Error in snlsetmoderator command:', error);
      await interaction.editReply({ 
        content: '❌ Failed to update moderator settings. Please try again later.'
      });
    }
  },
};
