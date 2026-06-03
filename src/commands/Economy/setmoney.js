import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('setmoney')
        .setDescription("Sets a user's wallet balance to an exact amount (Owner Only)")
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to modify')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('The exact amount to set')
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

        // Overwrite balance directly
        userData.wallet = Math.max(0, amount);
        
        await setEconomyData(client, guildId, targetUser.id, userData);

        const symbol = config?.economy?.currency?.symbol || '$';
        const embed = successEmbed(
            "⚖️ Admin Balance Adjustment",
            `Successfully forced **${targetUser.username}**'s wallet balance to **${symbol}${userData.wallet.toLocaleString()}**!`
        );

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'setmoney' })
};
