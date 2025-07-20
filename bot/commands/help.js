import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Shows all available SNL commands and their details'),

  async execute(interaction) {
    try {
      const commands = [
        {
          name: '/snlcreate',
          description: 'Create a new Snakes & Ladders game',
          usage: '/snlcreate <game_name>',
          permissions: 'Moderator only',
          category: 'Game Management'
        },
        {
          name: '/snlstartregistration',
          description: 'Start team registration for the current game',
          usage: '/snlstartregistration <team_size>',
          permissions: 'Moderator only',
          category: 'Game Management'
        },
        {
          name: '/snlstart',
          description: 'Start the current game with accepted participants (creates teams)',
          usage: '/snlstart',
          permissions: 'Moderator only',
          category: 'Game Management'
        },
        {
          name: '/snlsetup',
          description: 'Setup channels for teams and announcements',
          usage: '/snlsetup',
          permissions: 'Moderator only',
          category: 'Game Management'
        },
        {
          name: '/snlofficialstart',
          description: 'Officially start the game to allow teams to roll dice',
          usage: '/snlofficialstart',
          permissions: 'Moderator only',
          category: 'Game Management'
        },
        {
          name: '/snlpause',
          description: 'Pause the game to prevent teams from rolling',
          usage: '/snlpause',
          permissions: 'Moderator only',
          category: 'Game Management'
        },
        {
          name: '/snlresume',
          description: 'Resume a paused game to allow teams to roll again',
          usage: '/snlresume',
          permissions: 'Moderator only',
          category: 'Game Management'
        },
        {
          name: '/snlaccept',
          description: 'Accept pending applications for the current game',
          usage: '/snlaccept',
          permissions: 'Moderator only',
          category: 'Application Management'
        },
        {
          name: '/snldecline',
          description: 'Decline pending applications for the current game',
          usage: '/snldecline',
          permissions: 'Moderator only',
          category: 'Application Management'
        },
        {
          name: '/snlstatus',
          description: 'Check the status of the current game',
          usage: '/snlstatus',
          permissions: 'Everyone',
          category: 'Game Info'
        },
        {
          name: '/snlteams',
          description: 'List all team statuses for active games',
          usage: '/snlteams',
          permissions: 'Everyone',
          category: 'Game Info'
        },
        {
          name: '/snlboard',
          description: 'Show the current game board visually',
          usage: '/snlboard',
          permissions: 'Everyone',
          category: 'Game Info'
        },
        {
          name: '/roll',
          description: 'Roll the dice to move your team (Team leaders only)',
          usage: '/roll',
          permissions: 'Team leaders only',
          category: 'Gameplay'
        },
        {
          name: '/verify',
          description: 'Verify a team\'s task completion (Admin only)',
          usage: '/verify',
          permissions: 'Admin only',
          category: 'Gameplay'
        },
        {
          name: '/snlsubmit',
          description: 'Submit task completion proof for approval (wins if approved on tile 100!)',
          usage: '/snlsubmit <screenshot> [description]',
          permissions: 'Team leaders only',
          category: 'Gameplay'
        },
        {
          name: '/snlnextround',
          description: 'Allow all teams to roll again',
          usage: '/snlnextround',
          permissions: 'Moderator only',
          category: 'Game Management'
        },
        {
          name: '/snlreset',
          description: 'Reset game state (positions, rolls, or all data)',
          usage: '/snlreset <type>',
          permissions: 'Moderator only',
          category: 'Game Management'
        },
        {
          name: '/snlcleanup',
          description: 'Clean up channels and data from completed games',
          usage: '/snlcleanup <action>',
          permissions: 'Moderator only',
          category: 'Game Management'
        },
        {
          name: '/snlsetmoderator',
          description: 'Set or manage moderator roles',
          usage: '/snlsetmoderator [role] [action]',
          permissions: 'Admin only',
          category: 'Administration'
        },
        {
          name: '/ping',
          description: 'Check if the bot is responding',
          usage: '/ping',
          permissions: 'Everyone',
          category: 'Utility'
        }
      ];

      // Create main embed
      const embed = new EmbedBuilder()
        .setTitle('🎲 SNL Bot Commands Help')
        .setDescription('Here are all available commands for the Snakes & Ladders bot.\n\n**Single Game Mode**: Only one game can be active at a time!')
        .setColor('#0099ff')
        .setTimestamp();

      // Add command categories
      embed.addFields(
        {
          name: '🎮 Game Management Commands',
          value: '`/snlcreate` - Create a new game\n`/snlstartregistration` - Start registration\n`/snlstart` - Start the game (creates teams)\n`/snlsetup` - Setup team channels\n`/snlofficialstart` - Allow teams to roll\n`/snlpause` - Pause rolling\n`/snlresume` - Resume rolling\n`/snlnextround` - Allow all teams to roll\n`/snlreset` - Reset game state\n`/snlcleanup` - Clean up completed games',
          inline: false
        },
        {
          name: '📝 Application Management',
          value: '`/snlaccept` - Accept applications\n`/snldecline` - Decline applications',
          inline: true
        },
        {
          name: 'ℹ️ Game Information',
          value: '`/snlstatus` - Check game status\n`/snlteams` - View team standings\n`/snlboard` - Show game board',
          inline: true
        },
        {
          name: '🎯 Gameplay Commands',
          value: '`/roll` - Roll dice (team leaders)\n`/snlsubmit` - Submit task proof\n`/verify` - Verify task completion',
          inline: false
        },
        {
          name: '⚙️ Administration',
          value: '`/snlsetmoderator` - Manage moderator roles',
          inline: true
        },
        {
          name: '🔧 Utility',
          value: '`/ping` - Check bot status\n`/help` - Show this help',
          inline: true
        }
      );

      embed.addFields(
        {
          name: '🔑 Permission Levels',
          value: '**Admin**: Server Administrator\n**Moderator**: Set via `/snlsetmoderator`\n**Team Leaders**: Auto-assigned\n**Everyone**: All members',
          inline: false
        },
        {
          name: '📚 Quick Start Guide',
          value: '1. `/snlcreate` - Create game\n2. `/snlstartregistration` - Open registration\n3. Accept applications with `/snlaccept`\n4. `/snlstart` - Create teams\n5. `/snlsetup` - Setup team channels\n6. `/snlofficialstart` - Allow teams to roll dice!',
          inline: false
        },
        {
          name: '🏆 How to Win',
          value: '**Goal**: Be the first team to reach tile 100 and get verified!\n\n**Win Conditions**:\n• Reach tile 100 through rolling dice\n• Complete the task on tile 100\n• Get moderator approval via `/verify` OR task submission\n• First team to be verified on tile 100 wins!\n\n**After Win**: All other teams are locked from rolling.',
          inline: false
        }
      );

      // Check if development mode is enabled
      if (process.env.DEV_MODE === 'true') {
        embed.addFields({
          name: '🔧 Development Mode Active',
          value: 'Games can start with just 1 participant for testing purposes.',
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error executing help command:', error);
      await interaction.editReply({ 
        content: '❌ Failed to display help information. Please try again later.'
      });
    }
  },
};
