import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import Team from '../models/Team.js';

export default {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Verify a team\'s task completion and allow them to roll again (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.editReply({
        content: '❌ You need Administrator permissions to verify tasks.'
      });
    }
    try {
      // Check if this channel belongs to a team
      const team = await Team.findOne({ channelId: interaction.channelId });
      if (team) {
        // Allow the team to roll again
        team.canRoll = true;
        await team.save();
        await interaction.editReply({
          content: `✅ **${team.teamName}** can now roll again! Notified the team.`
        });
        // Notify the team channel if not already in it
        if (interaction.channelId !== team.channelId) {
          try {
            const teamChannel = await interaction.guild.channels.fetch(team.channelId);
            if (teamChannel) {
              await teamChannel.send({
                content: `🎉 Your task has been verified by an admin! You can now roll the dice again. Use "/roll" to continue.`
              });
            }
          } catch (err) { /* ignore */ }
        }
      } else {
        // Not in a team channel, show modal for manual selection
        // For now, we'll implement a simple approach without the modal
        const teams = await Team.find({ canRoll: false });
        
        if (teams.length === 0) {
          return await interaction.editReply({
            content: '✅ All teams are currently able to roll. No verification needed!'
          });
        }

        // Show list of teams that need verification
        const teamList = teams.map((team, index) => 
          `${index + 1}. **${team.teamName}** - Tile ${team.currentPosition} (Channel: <#${team.channelId}>)`
        ).join('\n');

        await interaction.editReply({
          content: `🎲 **Teams waiting for verification:**\n\n${teamList}\n\n💡 **Tip:** Use this command directly in a team's channel for quick verification!`
        });
      }
    } catch (error) {
      console.error('Error in verify command:', error);
      await interaction.editReply({
        content: '❌ Failed to process verification. Please try again later.'
      });
    }
  },
};
