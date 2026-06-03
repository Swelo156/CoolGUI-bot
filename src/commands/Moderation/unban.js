import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { ModerationService } from '../../services/moderationService.js';
import { handleInteractionError } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Unban a user by removing the Banned role")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The user to unban")
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName("reason")
                .setDescription("Reason for the unban"),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        try {
            const user = interaction.options.getUser("target");
            const reason = interaction.options.getString("reason") || "No reason provided";
            const guild = interaction.guild;

            // Fetch the user's member profile in the server
            const member = await guild.members.fetch(user.id).catch(() => null);
            if (!member) {
                throw new Error("That user is not currently in this server to be unbanned.");
            }

            // Find the "Banned" role
            const bannedRole = guild.roles.cache.find(role => role.name === 'Banned');
            if (!bannedRole) {
                throw new Error("The 'Banned' role was not found in this server.");
            }

            // Verify they actually have the role before attempting to remove it
            if (!member.roles.cache.has(bannedRole.id)) {
                throw new Error("This user is not currently soft-banned.");
            }

            // Remove the Banned role
            await member.roles.remove(bannedRole, `Unbanned by ${interaction.user.tag} - ${reason}`);

            // Log it in your moderation tracker history system
            let caseId = "N/A";
            try {
                const result = await ModerationService.logAction({
                    guildId: guild.id,
                    targetId: user.id,
                    moderatorId: interaction.user.id,
                    action: 'SOFT_UNBAN',
                    reason: reason
                });
                if (result && result.caseId) caseId = result.caseId;
            } catch (logError) {
                logger.warn('Could not log unban action to ModerationService, continuing anyway:', logError);
            }

            // Send out confirmation message
            await InteractionHelper.universalReply(interaction, {
                embeds: [
                    successEmbed(
                        `🔓 User Unrestricted`,
                        `Successfully removed the **Banned** role from **${user.username}**!`
                    ).addFields(
                        { name: "Case ID", value: `#${caseId}`, inline: true },
                        { name: "Reason", value: reason }
                    )
                ],
            });

        } catch (error) {
            logger.error('Unban command error:', error);
            await handleInteractionError(interaction, error, { subtype: 'unban_failed' });
        }
    },
};
