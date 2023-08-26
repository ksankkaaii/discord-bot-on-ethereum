const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    discordId: {
        type: String,
        required: true,
    },

    tokenAddress: {
        type: String,
        required: true
    },

    mentionedPrice: {
        type: String,
        required: true
    },

    purchaseAmount: {
        type: Number,
        required: true
    },

    slippagePercentage: {
        type: Number,
        required: true
    },

    isBuy: {
        type: Boolean,
        require: true
    },

    status:{
        type: Number, // ready, pending, success, failed, canceled
        require: true
    },

    createAt:{
        type: Date,
        require: true,
        default: Date.now()
    },
    
    updateAt:{
        type: Date,
        require: true,
        default: Date.now()
    },

    result:{ //success : transaction hash, failed: reason suchas no fund
        type: String
    }

})

module.exports = mongoose?.model('Order', OrderSchema);