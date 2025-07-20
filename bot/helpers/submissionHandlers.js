import { EmbedBuilder } from 'discord.js';
import Team from '../models/Team.js';
import Game from '../models/Game.js';
import GameParameters from '../models/GameParameters.js';

export async function handleSubmissionApproval(interaction) {
    try {
        // Don't defer here - it's already deferred by the main handler
        
        const customId = interaction.customId;
        const action = customId.startsWith('approve_') ? 'approve' : 'reject';
        const parts = customId.split('_');
        const gameId = parts[2];
        const submitterUserId = parts[3]; // The user who submitted the request
        
        // Get the game and check if user has moderator permissions
        const game = await Game.findById(gameId);
        if (!game) {
            return await interaction.followUp({
                content: '❌ Game not found.',
                ephemeral: true
            });
        }
        
        const gameParams = await GameParameters.findOne({ guildId: interaction.guild.id });
        if (!gameParams) {
            return await interaction.followUp({
                content: '❌ Game parameters not found.',
                ephemeral: true
            });
        }
        
        // Check if user has moderator permissions
        const member = interaction.member;
        const hasModeratorRole = gameParams.moderatorRoleId && member.roles.cache.has(gameParams.moderatorRoleId);
        const hasAdminRole = gameParams.adminRoleId && member.roles.cache.has(gameParams.adminRoleId);
        
        if (!hasModeratorRole && !hasAdminRole) {
            return await interaction.followUp({
                content: '❌ You do not have permission to approve or reject submissions.',
                ephemeral: true
            });
        }
        
        // Find the team by looking up the submitter
        const team = await Team.findOne({ 
            gameId: game.gameId, 
            $or: [
                { 'leader.userId': submitterUserId },
                { 'coLeader.userId': submitterUserId }
            ]
        });
        if (!team) {
            console.log(`Team lookup failed - gameId: ${game.gameId}, submitterUserId: ${submitterUserId}`);
            return await interaction.followUp({
                content: '❌ Team not found.',
                ephemeral: true
            });
        }
        
        if (action === 'approve') {
            // Check if team is on tile 100 - if so, they win!
            if (team.currentPosition === 100) {
                // Check if game already has a winner
                if (game.winnerTeamId) {
                    return await interaction.followUp({
                        content: '❌ This game already has a winner.',
                        ephemeral: true
                    });
                }
                
                // Set this team as the winner and mark game as completed
                game.winnerTeamId = team.teamId;
                game.completedAt = new Date();
                game.status = 'completed'; // Mark game as completed
                await game.save();
                
                // Lock all teams from rolling (winner already can't roll from tile 100)
                await Team.updateMany({ gameId: game.gameId }, { canRoll: false });
                
                // Send win confirmation to moderator
                const winEmbed = new EmbedBuilder()
                    .setTitle('🏆 GAME WON!')
                    .setDescription(`Team **${team.teamName}** submission approved on tile 100 - THEY WIN THE GAME! 🎉`)
                    .addFields({
                        name: '🎮 Game Winner',
                        value: team.teamName,
                        inline: true
                    }, {
                        name: '⏰ Won At',
                        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                        inline: true
                    })
                    .setColor('#FFD700')
                    .setTimestamp();
                
                await interaction.editReply({
                    embeds: [winEmbed],
                    components: []
                });
                
                // Send win announcement to the team's channel
                const teamWinEmbed = new EmbedBuilder()
                    .setTitle('🏆 CONGRATULATIONS! YOU WON!')
                    .setDescription(`Your task submission on tile 100 has been approved by ${interaction.user.displayName}!\n\n**🎉 YOUR TEAM WINS THE GAME! 🎉**`)
                    .addFields({
                        name: '🏅 Victory!',
                        value: 'You have successfully completed the Snakes & Ladders game!',
                        inline: false
                    })
                    .setColor('#FFD700')
                    .setTimestamp();
                
                // Send to the current channel (where submission was made)
                await interaction.followUp({ 
                    embeds: [teamWinEmbed],
                    ephemeral: false 
                });
                
                // Also send to team's official channel if different
                if (team.channelId && team.channelId !== 'dashboard-team' && team.channelId !== interaction.channelId) {
                    try {
                        const teamChannel = await interaction.client.channels.fetch(team.channelId);
                        if (teamChannel) {
                            await teamChannel.send({ embeds: [teamWinEmbed] });
                        }
                    } catch (error) {
                        console.error(`Failed to send win message to team channel ${team.channelId}:`, error);
                    }
                }
                
                // Send announcement to all announcement channels
                const gameWinEmbed = new EmbedBuilder()
                    .setTitle('🏆 GAME COMPLETED!')
                    .setDescription(`**${team.teamName}** has won the Snakes & Ladders game!`)
                    .addFields({
                        name: '🎮 Game',
                        value: game.name,
                        inline: true
                    }, {
                        name: '🏆 Winner',
                        value: team.teamName,
                        inline: true
                    }, {
                        name: '⏰ Completed',
                        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                        inline: true
                    })
                    .setColor('#FFD700')
                    .setTimestamp();
                
                // Send to main announcement channel if exists
                if (game.announcementChannelId) {
                    try {
                        const channel = await interaction.client.channels.fetch(game.announcementChannelId);
                        if (channel) {
                            await channel.send({ embeds: [gameWinEmbed] });
                        }
                    } catch (error) {
                        console.error(`Failed to send win announcement to main channel ${game.announcementChannelId}:`, error);
                    }
                }
                
                // Send to additional announcement channels if configured
                if (gameParams.announcementChannelIds && gameParams.announcementChannelIds.length > 0) {
                    for (const channelId of gameParams.announcementChannelIds) {
                        try {
                            const channel = await interaction.client.channels.fetch(channelId);
                            if (channel) {
                                await channel.send({ embeds: [gameWinEmbed] });
                            }
                        } catch (error) {
                            console.error(`Failed to send win announcement to channel ${channelId}:`, error);
                        }
                    }
                }
                
                return; // Exit early since game is won
            }
            
            // Regular approval (not on tile 100)
            // Approve the submission - allow team to roll again
            team.canRoll = true;
            await team.save();
            
            // Send confirmation to moderator
            const approveEmbed = new EmbedBuilder()
                .setTitle('✅ Submission Approved')
                .setDescription(`Team **${team.teamName}** submission has been approved by ${interaction.user.displayName}.`)
                .addFields({
                    name: '📋 Status',
                    value: 'Team can now roll dice again.',
                    inline: true
                })
                .setColor('#00ff00')
                .setTimestamp();
            
            await interaction.editReply({
                embeds: [approveEmbed],
                components: []
            });
            
            // Notify the team in the same channel
            const teamNotificationEmbed = new EmbedBuilder()
                .setTitle('🎉 Task Submission Approved!')
                .setDescription(`Your task submission has been approved by ${interaction.user.displayName}!`)
                .addFields({
                    name: '🎲 Next Steps',
                    value: 'You can now use `/roll` to roll the dice again.',
                    inline: false
                })
                .setColor('#00ff00')
                .setTimestamp();
            
            await interaction.followUp({ 
                embeds: [teamNotificationEmbed],
                ephemeral: false 
            });
            
        } else {
            // Reject the submission - team cannot roll yet
            const rejectEmbed = new EmbedBuilder()
                .setTitle('❌ Submission Rejected')
                .setDescription(`Team **${team.teamName}** submission has been rejected by ${interaction.user.displayName}.`)
                .addFields({
                    name: '📋 Status',
                    value: 'Team needs to resubmit their task completion.',
                    inline: true
                })
                .setColor('#ff0000')
                .setTimestamp();
            
            await interaction.editReply({
                embeds: [rejectEmbed],
                components: []
            });
            
            // Notify the team in the same channel
            const teamNotificationEmbed = new EmbedBuilder()
                .setTitle('❌ Task Submission Rejected')
                .setDescription(`Your task submission has been rejected by ${interaction.user.displayName}.`)
                .addFields({
                    name: '🔄 Next Steps',
                    value: 'Please review your task completion and use `/snlsubmit` again with proper proof.',
                    inline: false
                })
                .setColor('#ff0000')
                .setTimestamp();
            
            await interaction.followUp({ 
                embeds: [teamNotificationEmbed],
                ephemeral: false 
            });
        }
        
    } catch (error) {
        console.error('Error handling submission approval:', error);
        
        try {
            await interaction.followUp({
                content: '❌ There was an error processing the submission approval.',
                ephemeral: true
            });
        } catch (followUpError) {
            console.error('Failed to send error response:', followUpError);
        }
    }
}
