import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('addxp')
        .setDescription('Adds a specific amount of XP to a user (Owner Only)')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to give XP to')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('The amount of XP to add')
                .setRequired(true)
        ),
    category: "economy",

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        // Verify Owner Permission
        const isOwner = interaction.user.id === "1373968527408496774"; // ⚠️ Replace with your exact Discord ID
        if (!isOwner) {
            throw createError(
                "Unauthorized access", 
                ErrorTypes.PERMISSION, 
                "You do not have permission to use this command."
            );
        }

        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const guildId = interaction.guildId;

        if (targetUser.bot) {
            throw createError("Validation Error", ErrorTypes.VALIDATION, "Bots cannot have XP profiles.");
        }

        logger.info(`[ADMIN XP] Owner adding ${amount} XP to ${targetUser.id}`, { userId: targetUser.id, guildId });

        // Fetch user data from PostgreSQL database
        const userData = await getEconomyData(client, guildId, targetUser.id);
        if (!userData) {
            throw createError("Database Error", ErrorTypes.DATABASE, "Player profile data not found.");
        }

        // Initialize values if they do not exist yet
        if (typeof userData.xp !== 'number') userData.xp = 0;
        if (typeof userData.level !== 'number') userData.level = 1;

        // Append the new XP points
        userData.xp += amount;

        // Loop to process multi-level jumps if a massive amount of XP is given
        let levelsGained = 0;
        let xpNeeded = Math.floor((userData.level * 100) * 1.5);

        while (userData.xp >= xpNeeded) {
            userData.xp -= xpNeeded;
            userData.level += 1;
            levelsGained++;
            xpNeeded = Math.floor((userData.level * 100) * 1.5); // Recalculate for next level tier
        }

        // Save progress back to database
        await setEconomyData(client, guildId, targetUser.id, userData);

        // Build the result readout
        let description = `Successfully injected **${amount.toLocaleString()} XP** into **${targetUser.username}**'s activity profile!`;
        if (levelsGained > 0) {
            description += `\n\n📈 **Level Up Spillover:** Upgraded **${levelsGained}** times!`;
        }

        const embed = successEmbed("✨ Admin XP Injection", description)
            .addFields(
                { name: "Current Level", value: `Level ${userData.level}`, inline: true },
                { name: "Current XP Balance", value: `${userData.xp.toLocaleString()} / ${xpNeeded.toLocaleString()} XP`, inline: true }
            )
            .setFooter({
                text: `Authorized by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL()
            });

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'addxp' })
};
