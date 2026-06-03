import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { ModerationService } from '../../services/moderationService.js';
import { handleInteractionError } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName("massban")
        .setDescription("Soft-ban multiple users at once via IDs")
        .addStringOption((option) =>
            option
                .setName("ids")
                .setDescription("List of user IDs separated by spaces or commas")
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName("reason")
                .setDescription("Reason for the mass soft-ban"),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        try {
            const idsInput = interaction.options.getString("ids");
            const reason = interaction.options.getString("reason") || "Mass ban - No reason provided";
            const guild = interaction.guild;

            // Find the "Banned" role
            const bannedRole = guild.roles.cache.find(role => role.name === 'Banned');
            if (!bannedRole) {
                throw new Error("The 'Banned' role was not found. Please create it first.");
            }

            // Parse the IDs out of the text string input
            const targetIds = idsInput.split(/[\s,]+/).filter(id => id.trim().length > 0);
            
            if (targetIds.length === 0) {
                throw new Error("No valid user IDs were provided.");
            }

            let successCount = 0;
            let failedCount = 0;
            const processedList = [];

            // Defer reply since processing multiple members might take a few moments
            await interaction.deferReply();

            // Loop through each ID provided
            for (const userId of targetIds) {
                try {
                    // Skip if they try to massban themselves or the bot
                    if (userId === interaction.user.id || userId === client.user.id) {
                        failedCount++;
                        continue;
                    }

                    const member = await guild.members.fetch(userId).catch(() => null);
                    if (member && !member.roles.cache.has(bannedRole.id)) {
                        // Apply role
                        await member.roles.add(bannedRole, `Mass soft-banned by ${interaction.user.tag} - ${reason}`);
                        successCount++;
                        processedList.push(`<@${userId}>`);

                        // Log individually in your DB service records
                        try {
                            await ModerationService.logAction({
                                guildId: guild.id,
                                targetId: userId,
                                moderatorId: interaction.user.id,
                                action: 'MASS_SOFT_BAN',
                                reason: reason
                            });
                        } catch (e) {
                            // Suppress internal log errors so loop continues smoothly
                        }
                    } else {
                        failedCount++;
                    }
                } catch (loopError) {
                    failedCount++;
                    logger.warn(`Failed to process mass-ban role addition for ID ${userId}:`, loopError);
                }
            }

            // Final embed report display
            await interaction.editReply({
                embeds: [
                    successEmbed(
                        `🛠️ Mass Soft-Ban Processed`,
                        `Successfully restricted users using the **Banned** role.`
                    ).addFields(
                        { name: "Successful Restrictions", value: `${successCount} users`, inline: true },
                        { name: "Failed / Skipped Profiles", value: `${failedCount} users`, inline: true },
                        { name: "Reason Given", value: reason },
                        { name: "Processed Users", value: processedList.length > 0 ? processedList.join(', ') : 'None' }
                    )
                ]
            });

        } catch (error) {
            logger.error('Massban command error:', error);
            await handleInteractionError(interaction, error, { subtype: 'massban_failed' });
        }
    },
};
