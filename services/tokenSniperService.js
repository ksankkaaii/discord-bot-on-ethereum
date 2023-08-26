const TokenSniperModel = require('./../models/tokenSniper');

module.exports = {
    upsertSniperData: async (discordId, sniperData) => {
        try {
            const filter = { discordId };
            const update = { $set: sniperData };
            const hasData = await TokenSniperModel.findOne(filter);
            if(hasData) {
                await TokenSniperModel.updateOne(filter, update);
            }
            else {
                const newData = new TokenSniperModel({...filter, ...sniperData});
                await newData.save();
            }

            return true;
        } catch (err) {
            console.log(`Upsert token sniper data failed with err: ${err}`);
        }

        return false;
    },

    fetchSniperData: async (discordId = ``) => {
        try {
            if(discordId) {
                return await TokenSniperModel.find({discordId}); 
            }
            return await TokenSniperModel.find(); 
        } catch (error) {
            console.log(`Getting token sniper data failed with err: ${err}`);
        }

        return [];
    },

    removeData: async (discordId) => {
        try {
            const deletedCount =  await OrderModel.deleteOne({
                discordId
            });
            if(deletedCount?.deletedCount) {
                return true;
            }
            
        } catch (error) {
            console.log(`Removing token sniper data failed with err: ${err}`);
        }

        return false;
    }
};