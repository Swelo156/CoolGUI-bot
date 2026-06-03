import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { ModerationService } from '../../services/moderationService.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import ms from 'ms'; // This package handles parsing text like "1d", "2h", "30m" into milliseconds

export default {
    data: new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Soft-ban a user by assigning the Banned role")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The user to restrict")
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName("duration")
                .setDescription("Duration of the ban (e.g., 1d, 2h, 30m) or leave blank for Permanent")
                .setRequired(false),
        )
        .addStringOption((option) =>
            option
                .setName("reason")
                .setDescription("Reason for the soft-ban"),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        try {
            const user = interaction.options.getUser("target");
            const durationString = interaction.options.getString("duration");
            const reason = interaction.options.getString("reason") || "No reason provided";
            const guild = interaction.guild;

            // Basic target safety checks
            if (user.id === interaction.user.id) {
                throw new Error("You cannot ban yourself.");
            }
            if (user.id === client.user.id) {
                throw new Error("You cannot ban the bot.");
            }

            // Fetch the user's member profile in the server
            const member = await guild.members.fetch(user.id).catch(() => null);
            if (!member) {
                throw new Error("That user is not currently in this server.");
            }

            // Find the "Banned" role in the server
            const bannedRole = guild.roles.cache.find(role => role.name === 'Banned');
            if (!bannedRole) {
                throw new Error("The 'Banned' role was not found. Please create a role named exactly 'Banned' first.");
            }

            if (member.roles.cache.has(bannedRole.id)) {
                throw new Error("This user is already soft-banned.");
            }

            // Calculate duration if it's a temporary ban
            let isPermanent = true;
            let durationMs = 0;

            if (durationString) {
                durationMs = ms(durationString);
                if (!durationMs) {
                    throw new Error("Invalid time format! Please use formats like 30m, 2h, 1d, or 7d.");
                }
                isPermanent = false;
            }

            // Apply the Banned role
            await member.roles.add(bannedRole, `Soft-banned by ${interaction.user.tag} - ${reason}`);

            // Log it in your moderation tracker history system
            let caseId = "N/A";
            try {
                const result = await ModerationService.logAction({
                    guildId: guild.id,
                    targetId: user.id,
                    moderatorId: interaction.user.id,
                    action: isPermanent ? 'SOFT_BAN' : 'TEMP_SOFT_BAN',
                    reason: `${reason} [Duration: ${durationString || 'Permanent'}]`
                });
                if (result && result.caseId) caseId = result.caseId;
            } catch (logError) {
                logger.warn('Could not log soft-ban action to ModerationService, continuing anyway:', logError);
            }

            // Send out the confirmation message
            const durationText = isPermanent ? '🔴 Permanent' : `⏳ Temporary (${durationString})`;
            
            await InteractionHelper.universalReply(interaction, {
                embeds: [
                    successEmbed(
                        `🔨 User Restricted`,
                        `**${user.username}** has been given the **Banned** role and restricted to tickets.`
                    ).addFields(
                        { name: "Type / Duration", value: durationText, inline: true },
                        { name: "Case ID", value: `#${caseId}`, inline: true },
                        { name: "Reason", value: reason }
                    )
                ],
            });

            // If it is a temporary ban, schedule the timer to automatically unban them
            if (!isPermanent) {
                setTimeout(async () => {
                    try {
                        const checkMember = await guild.members.fetch(user.id).catch(() => null);
                        if (checkMember && checkMember.roles.cache.has(bannedRole.id)) {
                            await checkMember.roles.remove(bannedRole, 'Temporary soft-ban duration expired.');
                            logger.info(`[MODERATION] Auto-removed Banned role from ${user.id} (Time Expired)`);
                        }
                    } catch (timerError) {
                        logger.error(`Failed to auto-unban user ${user.id} after timer ended:`, timerError);
                    }
                }, durationMs);
            }

        } catch (error) {
            logger.error('Ban command error:', error);
            await handleInteractionError(interaction, error, { subtype: 'ban_failed' });
        }
    },
};
