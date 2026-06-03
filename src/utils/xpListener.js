import { getEconomyData, setEconomyData } from '../utils/economy.js'; // Uses your framework's exact DB engine
import { successEmbed } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';

// Cooldown tracker to prevent spamming
const xpCooldowns = new Set();

export default {
    name: 'messageCreate',
    async execute(message, client) {
        // Ignore bots, system messages, or DMs
        if (message.author.bot || !message.guild) return;

        const userId = message.author.id;
        const guildId = message.guild.id;
        const cooldownKey = `${guildId}-${userId}`;

        // If user is on a 60-second cooldown, don't give XP yet
        if (xpCooldowns.has(cooldownKey)) return;

        try {
            // Fetch their data using your framework's existing utility
            const userData = await getEconomyData(client, guildId, userId);
            if (!userData) return;

            // Set default values if they don't have XP data yet
            if (typeof userData.xp !== 'number') userData.xp = 0;
            if (typeof userData.level !== 'number') userData.level = 1;

            // Generate a random amount of XP between 15 and 25
            const xpGained = Math.floor(Math.random() * 11) + 15;
            userData.xp += xpGained;

            // Algorithm to calculate needed XP for next level: (Level * 100) * 1.5
            const xpNeededForNextLevel = Math.floor((userData.level * 100) * 1.5);

            // Check if they leveled up!
            if (userData.xp >= xpNeededForNextLevel) {
                userData.level += 1;
                userData.xp = 0; // Reset or carry over leftover XP

                // Send a slick level up message right in the chat
                const levelEmbed = successEmbed(
                    "🎉 LEVEL UP!",
                    `GG <@${userId}>, you just advanced to **Level ${userData.level}**!`
                ).setFooter({ text: "Keep chatting to unlock more ranks!" });

                await message.reply({ embeds: [levelEmbed] }).catch(() => null);
            }

            // Save the data back to your PostgreSQL database
            await setEconomyData(client, guildId, userId, userData);

            // Add them to the 60-second cooldown list
            xpCooldowns.add(cooldownKey);
            setTimeout(() => xpCooldowns.delete(cooldownKey), 60000);

        } catch (error) {
            logger.error(`[XP SYSTEM] Error handling XP for user ${userId}:`, error);
        }
    }
};
