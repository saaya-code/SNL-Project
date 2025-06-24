import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import Team from '../models/Team.js';
import Game from '../models/Game.js';
import { requireModeratorPermissions } from '../helpers/moderatorHelpers.js';
import { getSingleActiveGame } from '../helpers/singleGameHelpers.js';

export default {
  data: new SlashCommandBuilder()
    .setName('snlnextround')
    .setDescription('Start the next round - allows all teams to roll again (Moderator only)'),

  async execute(interaction) {
    // Check moderator permissions
    if (!(await requireModeratorPermissions(interaction))) {
      return;
    }

    try {
      // Find the single active game
      const game = await getSingleActiveGame();
      if (!game) {
        return await interaction.editReply({ 
          content: '❌ No active game found. Use `/snlcreate` to create a new game.'
        });
      }

      // Find all teams for this game
      const teams = await Team.find({ gameId: game.gameId });
      
      if (teams.length === 0) {
        return await interaction.editReply({ 
          content: `❌ No teams found for game "${game.name}".`
        });
      }

      // Reset canRoll to true for all teams
      await Team.updateMany(
        { gameId: game.gameId },
        { $set: { canRoll: true } }
      );

      // Create summary embed
      const embed = new EmbedBuilder()
        .setTitle(`🔄 Next Round Started - ${game.name}`)
        .setDescription('All teams can now roll the dice again!')
        .addFields(
          { name: '🎮 Game', value: game.name, inline: true },
          { name: '🏆 Teams Reset', value: teams.length.toString(), inline: true },
          { name: '🎲 Status', value: 'All teams can roll', inline: true },
          { name: '📊 Team Positions', value: teams
            .sort((a, b) => b.currentPosition - a.currentPosition)
            .map((team, index) => {
              const position = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
              return `${position} ${team.teamName}: Tile ${team.currentPosition}`;
            }).join('\n') 
          }
        )
        .setColor('#00ff00')
        .setFooter({ text: `Round started by ${interaction.user.displayName}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Notify all team channels
      for (const team of teams) {
        try {
          const teamChannel = await interaction.guild.channels.fetch(team.channelId);
          if (teamChannel) {
            const teamEmbed = new EmbedBuilder()
              .setTitle('🔄 New Round Started!')
              .setDescription(`Your team can now roll the dice again! Use \`/roll\` to move forward.`)
              .addFields(
                { name: '📍 Current Position', value: `Tile ${team.currentPosition}`, inline: true },
                { name: '🎲 Rolling Status', value: '✅ Ready to roll', inline: true },
                { name: '👑 Who Can Roll', value: `${team.leader.displayName} (Leader)\n${team.coLeader.displayName} (Co-Leader)` }
              )
              .setColor('#00ff00')
              .setTimestamp();

            await teamChannel.send({ embeds: [teamEmbed] });
          }
        } catch (error) {
          console.log(`Could not notify team ${team.teamName}:`, error);
        }
      }

    } catch (error) {
      console.error('Error starting next round:', error);
      await interaction.editReply({ 
        content: '❌ Failed to start next round. Please try again later.'
      });
    }
  },
};
