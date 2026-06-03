import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('removemoney')
        .setDescription('Removes economy currency from a user (Owner Only)')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to penalize')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('The amount of money to remove')
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

        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const guildId = interaction.guildId;

        if (targetUser.bot) {
            throw createError("Validation Error", ErrorTypes.VALIDATION, "Bots do not have economy profiles.");
        }

        const userData = await getEconomyData(client, guildId, targetUser.id);
        if (!userData) {
            throw createError("Database Error", ErrorTypes.DATABASE, "Player data not found.");
        }

        // Subtract money, ensuring wallet doesn't go below 0
        const currentWallet = typeof userData.wallet === 'number' ? userData.wallet : 0;
        userData.wallet = Math.max(0, currentWallet - amount);
        
        await setEconomyData(client, guildId, targetUser.id, userData);

        const symbol = config?.economy?.currency?.symbol || '$';
        const embed = successEmbed(
            "📉 Admin Financial Penalty",
            `Successfully confiscated **${symbol}${amount.toLocaleString()}** from **${targetUser.username}**'s wallet!`
        ).addFields({
            name: "New Cash Balance",
            value: `${symbol}${userData.wallet.toLocaleString()}`,
            inline: true,
        });

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'removemoney' })
};
