/*
 * File name: index.js
 * Description: Main file for this bot.
 */

require('dotenv').config()
const Discord = require('discord.js');
const client = new Discord.Client();

// log the logged in account
client.on('ready', () => {
  console.log('\n----------');
  console.log('Logged in as:');
  console.log(client.user.username + '#' + client.user.discriminator)
  console.log(client.user.id);
  console.log('----------\n');
});

// login with token from .env
client.login(process.env.DISCORD_TOKEN);
