const ethers = require('ethers');
const constants = require('./constants');

class TokenSniper {

	constructor() {
		this.sniperData = [];
	}

    setSniperData(sniperData) {
		this.sniperData.push(sniperData);
	}

	getSniperData(discordId) {
		return this.sniperData.find((sniper) => {
            return sniper.discordId === discordId;
        });
	}

    updateSniperData(discordId, sniperData) {
        this.sniperData = this.sniperData.map((sniper) => {
            if(sniper.discordId === discordId) {
                return sniperData;
            }
            return sniper;
        });
    }

    removeSniperData(discordId) {
        this.sniperData = this.sniperData.filter((sniper) => {
            return sniper.discordId !== discordId;
        });
    }
}

module.exports = TokenSniper;