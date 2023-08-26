const mongoose = require('mongoose');
const constants = require("./../libs/constants");

const TradehistorySchema = new mongoose.Schema({
    discordId: {
        type: String,
        required: true
    },
    walletAddress: {
        type: String,
        required: true
    },
    tradeMode: {
        type: String,
        enum: [constants.TRADE_MODE.SELL, constants.TRADE_MODE.BUY],
        required: true
    },
    tokenAddress: {
        type: String,
        required: true
    },
    tradeAmount: {
        type: String,
        required: true
    },
    transaction: {
        type: String,
        required: true
    },
    tradeAt: {
        type: Date,
        default: Date.now
    },
    tradePrice: {
        type: String,
        required: true
    },
    tradeResult:{
        type: String,
        required: true
    },
    tokenSymbol: {
        type: String,
        required: true
    }, 
    tokenDecimals: {
        type: Number,
        required: true
    }, 
    swapID:{
        type:Number,
        required:true
    },
    tradeSort: {
        type:String,
        enum: [constants.TRADE_SORT.MANUAL, constants.TRADE_SORT.LIMIT_ORDER, constants.TRADE_SORT.SNIPE],
    }
})

module.exports = mongoose?.model('Tradehistory', TradehistorySchema);