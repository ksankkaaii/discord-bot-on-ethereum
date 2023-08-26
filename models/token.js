const mongoose = require('mongoose');

const TokenSchema = new mongoose.Schema({
    address: {
        type: String,
        required: true
    },
    sellPrice: {
        type: Number
    },
    buyPrice: {
        type: Number
    },
    pair:{
        type: String
    },
    liquidity:{
        type: String
    },
    updateBlock: {
        type: Number
    },
    decimals: {
        type: Number
    }
})

module.exports = mongoose?.model('Token', TokenSchema);