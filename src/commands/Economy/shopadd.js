import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js'; // Adjust paths based on your bot layout
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('shopadd')
        .setDescription('Add a new item to the server shop (Owner Only)')
        .addStringOption(option =>
            option
                .setName('name')
                .setDescription('The name of the item')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('price')
                .setDescription('The price in server currency')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('description')
                .setDescription('What does this item do?')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('secret')
                .setDescription('Optional code/key DM’d to the user upon purchase')
                .setRequired(false)
        ),
    category: "economy",

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        // Verify Owner Permission
        const isOwner = interaction.user.id === "1373968527408496774"; // ⚠️ Replace with your exact Discord ID
        if (!isOwner) {
            throw createError("Unauthorized access", ErrorTypes.PERMISSION, "You do not have permission to use this command.");
        }

        const name = interaction.options.getString('name');
        const price = interaction.options.getInteger('price');
        const description = interaction.options.getString('description');
        const secret = interaction.options.getString('secret') || null;
        const guildId = interaction.guildId;

        if (price <= 0) {
            throw createError("Validation Error", ErrorTypes.VALIDATION, "Price must be greater than 0.");
        }

        // We fetch a generic profile to attach global server shop data, or a specific guild profile
        // For safety across your framework, we can store it inside a special placeholder ID like "GUILD_SHOP_DATA"
        const shopData = await getEconomyData(client, guildId, `SHOP_${guildId}`) || { items: [] };
        
        if (!shopData.items) shopData.items = [];

        // Check if item name already exists
        if (shopData.items.some(item => item.name.toLowerCase() === name.toLowerCase())) {
            throw createError("Duplicate Item", ErrorTypes.VALIDATION, "An item with that name already exists in the shop.");
        }

        // Create the item object
        const newItem = {
            id: Date.now().toString(),
            name,
            price,
            description,
            secret,
            sellerId: "SERVER", // Official shop item
            createdAt: new Date().toISOString()
        };

        shopData.items.push(newItem);
        await setEconomyData(client, guildId, `SHOP_${guildId}`, shopData);

        logger.info(`[SHOP ADMIN] Created new shop item: ${name} for $${price}`);

        const symbol = config?.economy?.currency?.symbol || '$';
        const embed = successEmbed(
            "🛒 Shop Item Added Successfully!",
            `Added **${name}** to the official server store.`
        ).addFields(
            { name: "Price", value: `${symbol}${price.toLocaleString()}`, inline: true },
            { name: "Description", value: description, inline: false }
        );

        if (secret) {
            embed.addFields({ name: "🔒 Key Vault Status", value: "Vaulted Secret Key attached successfully.", inline: true });
        }

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'shopadd' })
};
