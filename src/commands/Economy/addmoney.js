import { SlashCommandBuilder } from 'discord.js';
import { botConfig } from '../../config.js';

export const data = new SlashCommandBuilder()
  .setName('addmoney')
  .setDescription('Adds economy currency to a user (Owner Only)')
  .addUserOption(option => 
    option.setName('user')
      .setDescription('The user to give money to')
      .setRequired(true)
  )
  .addIntegerOption(option => 
    option.setName('amount')
      .setDescription('The amount of money to add')
      .setRequired(true)
  );

export const execute = async (interaction) => {
  const targetUser = interaction.options.getUser('user');
  const amount = interaction.options.getInteger('amount');

  // 1. Check if the person running the command is listed as an owner
  const isOwner = botConfig.commands.owners.includes(interaction.user.id);
  
  if (!isOwner) {
    return interaction.reply({ 
      content: botConfig.messages.noPermission, 
      ephemeral: true 
    });
  }

  // 2. Database integration
  // This bot uses a database module. Based on standard setups for this template, 
  // it likely looks like this. If it errors, check your other files (like work.js) 
  // to see exactly how it saves balance.
  try {
    const db = interaction.client.db; 
    await db.addBalance(targetUser.id, amount); 
  } catch (err) {
    // Fallback if your database handler is structured differently
    return interaction.reply({ content: "Could not connect to database handler.", ephemeral: true });
  }

  return interaction.reply({
    content: `💰 Added **${botConfig.economy.currency.symbol}${amount}** to ${targetUser.username}'s balance!`
  });
};
