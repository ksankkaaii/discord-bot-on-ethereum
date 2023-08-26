const { Network } = require('../libs/main.js');


const { 
	SlashCommandBuilder, 
	ActionRowBuilder, 
	ButtonBuilder, 
	ButtonStyle,
	EmbedBuilder
} = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('hp')
		.setDescription('Check if token is honeypot.')
		.addStringOption(option => option.setName('token').setDescription('The address of the token.').setRequired(true)),
		async execute(interaction) {

			Network.honeypotCheck(interaction, interaction.options.getString('token'));
			
		},
};