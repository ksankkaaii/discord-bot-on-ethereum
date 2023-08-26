const TokenModel = require('../models/interaction');

module.exports = {
    saveTokenInfoByInteraction: async (interaction, tokenAddress) => {
        const filter = {
            interaction
        }
        const update = { $set: { tokenAddress: tokenAddress } };

        try {
            const info = await TokenModel.findOne(filter);

            if(info) {
                await TokenModel.updateOne(filter, update);
            }
            else {
                const newData = new TokenModel({...filter, tokenAddress: tokenAddress});
                await newData.save();
            }

            return true;
        }
        catch(err) {
            console.log(`error when saving token info by interaction: ${err}`);
        }

        return false;
    },

    getTokenInfoByInteraction: async (interaction) => {
        const filter = {
            interaction
        }

        try {
            const info = await TokenModel.findOne(filter);

            return info;
        }
        catch(err) {
            console.log(`error when getting the token info by interaction: ${err}`);
        }

        return null;
    }
};