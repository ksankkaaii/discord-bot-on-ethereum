const TradehistoryModel = require('../models/tradehistory');

module.exports = {
	registerHistory: async (discordId, walletAddress, tradeMode, tokenAddress, tradeAmount, transaction, tradePrice, tradeAt, symbol, decimals, tradeResult, tradeSort, _swapID = 0) => {
        try {
            const newData = new TradehistoryModel({
                discordId,
                walletAddress,
                tradeMode, 
                tokenAddress,
                tradeAmount: tradeAmount.toString() || `0`,
                transaction,
                tradeAt: tradeAt,
                tradePrice: tradePrice.toString() || `0`,
                tokenSymbol: symbol,
                tokenDecimals: decimals,
                tradeResult: tradeResult.toString(),
                tradeSort: tradeSort,
                swapID: _swapID

            });
            await newData.save();

            return newData;
        }
        catch (err) {
            console.log("Saving the trade history failed with error: " + err);
        }
    
        return null;
    },

    getTradeHistory: async (discordId, limit = 1) => {
        try {
            const hostiries = await TradehistoryModel.find({
                discordId
            }).sort({tradeAt: -1}).limit(limit);
    
            return hostiries;
        }
        catch(err) {
            console.log(`Fetching the trade history of user(${discordId}) failed with error: ` + err);
        }
    
        return [];
    },

    getTradeInfo: async (discordId, tokenAddress) => {
        try {
            const hostiries = await TradehistoryModel.find({
                discordId,
                tokenAddress
            }).sort({
                tradeAt: `desc`
            });
    
            return hostiries;
        }
        catch(err) {
            console.log(`Fetching the trade history of user(${discordId}) failed with error: ` + err);
        }
    
        return [];
    },

    getTradeInfoByTx: async (tx) => {
        try {
            return await TradehistoryModel.findOne({
                transaction: tx
            });
        }
        catch(err) {
            console.log(`Fetching the trade history for tx(${tx}) failed with error: ` + err);
        }
    
        return null;
    },
    
    fetchTradeData: async (filter) => {
        try {
            return await TradehistoryModel.findOne({
                filter
            });
        }
        catch(err) {
            console.log(`Fetching the trade history for failed with error: ` + err);
        }
    
        return null;
    }
};