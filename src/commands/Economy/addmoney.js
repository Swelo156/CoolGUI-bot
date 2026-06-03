import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, successEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('addmoney')
        .setDescription('Adds economy currency to a user (Owner Only)')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to give money to')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('The amount of money to add')
                .setRequired(true)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        // 1. Verify permissions by checking your exact Discord ID
        const isOwner = interaction.user.id === "1373968527408496774"; // ⚠️ Replace this with your real ID!
        if (!isOwner) {
            throw createError(
                "Unauthorized access attempt to addmoney",
                ErrorTypes.PERMISSION,
                config?.messages?.noPermission || "You do not have permission to use this command."
            );
        }

        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const guildId = interaction.guildId;

        if (targetUser.bot) {
            throw createError(
                "Bot user targeted for cash generation",
                ErrorTypes.VALIDATION,
                "You cannot add money to a bot account."
            );
        }

        logger.info(`[ADMIN ECONOMY] Owner adding $${amount} to ${targetUser.id}`, { userId: targetUser.id, guildId });

        // 2. Fetch the target user's economy database reference
        const userData = await getEconomyData(client, guildId, targetUser.id);
        if (!userData) {
            throw createError(
                "Failed to find profile data",
                ErrorTypes.DATABASE,
                "Failed to process request. Player account data not found.",
                { userId: targetUser.id, guildId }
            );
        }

        // 3. Mutate the wallet total safely
        userData.wallet = (typeof userData.wallet === 'number' ? userData.wallet : 0) + amount;
        
        // 4. Save using the correct framework function we found in daily.js!
        await setEconomyData(client, guildId, targetUser.id, userData);

        const symbol = config?.economy?.currency?.symbol || '$';
        const embed = successEmbed(
            "✅ Admin Cash Injection!",
            `Successfully generated **${symbol}${amount.toLocaleString()}** and added it into **${targetUser.username}**'s wallet!`
        )
            .addFields({
                name: "New Cash Balance",
                value: `${symbol}${userData.wallet.toLocaleString()}`,
                inline: true,
            })
            .setFooter({
                text: `Authorized by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL(),
            });

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'addmoney' })
};
