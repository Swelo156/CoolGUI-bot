import { botConfig } from '../../config.js';

export const run = async (client, message, args) => {
  // 1. Check if the person running the command is listed as an owner
  const isOwner = botConfig.commands.owners.includes(message.author.id);
  
  if (!isOwner) {
    return message.reply(botConfig.messages.noPermission);
  }

  // Get the tagged user and amount from the message (e.g., !addmoney @User 5000)
  const targetUser = message.mentions.users.first();
  const amount = parseInt(args[1]);

  if (!targetUser || isNaN(amount)) {
    return message.reply("❌ Usage: `!addmoney @user <amount>`");
  }

  try {
    const db = client.db; 
    await db.addBalance(targetUser.id, amount); 
  } catch (err) {
    return message.reply("❌ Database handler error.");
  }

  return message.reply(`💰 Added **${botConfig.economy.currency.symbol}${amount}** to ${targetUser.username}'s balance!`);
};
