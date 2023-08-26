const TokenDataModel = require('./../models/tokendata');

module.exports = {
    upsertToken: async (filter, tokenInfo) => {
        try {
            const tokenData = await TokenDataModel.findOne(filter);

            if(tokenData) {
                const update = { $set: tokenInfo };
                await TokenDataModel.updateOne(filter, update);
            }
            else {
                const newData = new TokenDataModel({...filter, ...tokenInfo});
                await newData.save();
            }

            return true;
        }
        catch(err) {
            console.log(`Upsert  token data failed with error: ${err}`);
        }

        return false;
    },

    fetchTokenData: async (filter = null) => {
        try {
            if(!filter) {
                return await TokenDataModel.find();
            }
            else {
                return await TokenDataModel.find(filter);
            }
        }
        catch(err) {
            console.log(`Get token data failed with error: ${err}`);
        }
        
        return [];
    }
};