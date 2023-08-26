const { 
	Client, 
	ButtonStyle, 
	ButtonBuilder, 
	EmbedBuilder, 
	Events, 
	InteractionType,
	ModalBuilder, 
	TextInputBuilder, 
	TextInputStyle, 
	ActionRowBuilder, 
	GatewayIntentBits 
} = require('discord.js');
const ethers = require('ethers');

class Helpers {

	isInt(value) {
	  	return !isNaN(value) && 
	         parseInt(Number(value)) == value && 
	         !isNaN(parseInt(value, 10));
	}

	isFloat(value) {

		if(this.isInt(value))
			return true;

	  	return !isNaN(value) && 
	         parseFloat(value) == value && 
	         !isNaN(parseFloat(value, 10));
	}

	padTo2Digits(num) {
	  return num.toString().padStart(2, '0');
	}

	formatDate(date) {
	  return (
	    [
	      date.getFullYear(),
	      this.padTo2Digits(date.getMonth() + 1),
	      this.padTo2Digits(date.getDate()),
	    ].join('-') +
	    ' ' +
	    [
	      this.padTo2Digits(date.getHours()),
	      this.padTo2Digits(date.getMinutes()),
	      this.padTo2Digits(date.getSeconds()),
	    ].join(':')
	  );
	}

	dotdot(string) {

		if(string == null)
			return 'N/A';

		return string.replace(string.substr(5, string.length - 10), '...');
	}

	isValidDiscordUserId(userId) {
		// Check that the user ID is exactly 18 characters long and contains only numeric characters
		const regex = /^\d{18}$/;
		return regex.test(userId);
	  }
	
	toFixedNumber(num, decimals) {
		if(isNaN(num)) {
			return `0`;
		}
		return parseFloat(Number(num)).toFixed(decimals);
	}

	checkValidDiscordUserName(username) {
		const regex = /^[a-zA-Z0-9_]{2,32}$/;
		return regex.test(username);
	}

	convertWeiToScriptEth(wei) {
		if(wei.gte(ethers.utils.parseUnits(`1`, 18))) {
			return parseFloat(ethers.utils.formatUnits(wei, 18)).toFixed(3);
		}
		if(wei.eq(ethers.utils.parseUnits(`0`, 18))) {
			return parseFloat(0).toFixed(3);
		}

		const subscripts = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉', '₁₀', '₁₁', '₁₂', '₁₃', '₁₄', '₁₅', '₁₆', '₁₇', '₁₈'];
		const weiNum = parseFloat(Number(ethers.utils.formatUnits(wei, 18)));
		const digits = wei.toString().substring(0, 3).replace(/\.?0+$/, '');
		let exponent = Math.floor(Math.log10(weiNum)) * -1;
		exponent = exponent - 1;

		if(exponent == 0) {
			return `0.${digits}`
		}
		return `0.0${subscripts[exponent]}${digits}`
	}

	parseBigNumber(num) {
		let result = `0`;
		try {
			num = Math.round(parseFloat(Number(num)));
			result = `${num}`;
			if(num >= 1000 && num < 1000000) {
				result = `${(num / 1000).toFixed(1)}K`;
			}

			if(num > 1000000) {
				result = `${(num / 1000000).toFixed(1)}M`;
			}

			if(num > 1000000000) {
				result = `${(num / 1000000000).toFixed(1)}G`;
			}
		}
		catch(err) {
			console.log(`Formatting big number failed with error: ${err}`);
		}

		return result;
	}
}

module.exports = new Helpers();