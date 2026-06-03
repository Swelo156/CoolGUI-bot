import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, successEmbed } from '../../utils/embeds.js';
import { getEconomyData } from '../../utils/economy.js';
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

        // 1. Verify permissions using your global bot configuration file
        const isOwner = config?.commands?.owners?.includes(interaction.user.id);
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

        // 3. Mutate the wallet total safely and apply changes to the DB record
        userData.wallet = (typeof userData.wallet === 'number' ? userData.wallet : 0) + amount;
        await userData.save(); 

        const symbol = config?.economy?.currency?.symbol || '$';
        const embed = successEmbed(`Successfully generated **${symbol}${amount.toLocaleString()}** and added it into **${targetUser.username}**'s wallet!`)
            .setTitle("💰 Admin Cash Injection")
            .setFooter({
                text: `Authorized by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL(),
            });

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'addmoney' })
};
