import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, infoEmbed } from '../../utils/embeds.js';
import { getEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription("Displays a user's current server level and XP profile")
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user whose rank you want to inspect')
                .setRequired(false)
        ),
    category: "economy",

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const guildId = interaction.guildId;

        if (targetUser.bot) {
            throw createError("Validation Error", ErrorTypes.VALIDATION, "Bots do not earn XP profiles.");
        }

        // Fetch their database profile data
        const userData = await getEconomyData(client, guildId, targetUser.id);
        
        // Default fallbacks if they haven't typed yet
        const currentXp = userData?.xp || 0;
        const currentLevel = userData?.level || 1;
        const xpNeeded = Math.floor((currentLevel * 100) * 1.5);

        // Build a text-based visual progress bar [■■■■□□□□□□]
        const progressBarLength = 10;
        const progressPercent = Math.min(currentXp / xpNeeded, 1);
        const filledBlocks = Math.round(progressPercent * progressBarLength);
        const emptyBlocks = progressBarLength - filledBlocks;
        const progressBarStr = "🟩".repeat(filledBlocks) + "⬛".repeat(emptyBlocks);

        const percentDisplay = Math.round(progressPercent * 100);

        // Build a super clean rank profile display card
        const embed = infoEmbed(
            `📊 ${targetUser.username}'s Activity Profile`,
            `Current status updates for this server's leaderboard ranking.`
        )
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: "✨ Current Level", value: `**Level ${currentLevel}**`, inline: true },
            { name: "📈 XP Progress", value: `${currentXp.toLocaleString()} / ${xpNeeded.toLocaleString()} XP (${percentDisplay}%)`, inline: true },
            { name: "Progress Bar", value: `${progressBarStr}`, inline: false }
        )
        .setFooter({
            text: `Requested by ${interaction.user.tag}`,
            iconURL: interaction.user.displayAvatarURL()
        });

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'rank' })
};
