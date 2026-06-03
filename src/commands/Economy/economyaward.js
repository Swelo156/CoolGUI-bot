import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('economyaward')
        .setDescription('Awards cash to EVERY member in the server (Owner Only)')
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Amount to drop to everyone')
                .setRequired(true)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        // Verify Owner Permission
        const isOwner = interaction.user.id === "1373968527408496774"; // ⚠️ Put your ID here
        if (!isOwner) {
            throw createError("Unauthorized access", ErrorTypes.PERMISSION, "You do not have permission to use this command.");
        }

        const amount = interaction.options.getInteger('amount');
        const guild = interaction.guild;

        // Fetch all members in the server to ensure we catch everyone active
        const members = await guild.members.fetch();
        let awardCount = 0;

        // Loop through everyone and add money if they aren't a bot
        for (const [id, member] of members) {
            if (!member.user.bot) {
                try {
                    const userData = await getEconomyData(client, guild.id, id);
                    if (userData) {
                        userData.wallet = (typeof userData.wallet === 'number' ? userData.wallet : 0) + amount;
                        await setEconomyData(client, guild.id, id, userData);
                        awardCount++;
                    }
                } catch (err) {
                    logger.error(`Failed to award economy cash to ${id}`, err);
                }
            }
        }

        const symbol = config?.economy?.currency?.symbol || '$';
        const embed = successEmbed(
            "🎉 Server-Wide Stimulus Package!",
            `The host has distributed **${symbol}${amount.toLocaleString()}** directly to **${awardCount}** active server members!`
        ).setFooter({
            text: `Hosted by ${interaction.user.tag}`,
            iconURL: interaction.user.displayAvatarURL()
        });

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'economyaward' })
};
