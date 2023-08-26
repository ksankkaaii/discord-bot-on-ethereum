const mongoose = require('mongoose');

const TokendataSchema = new mongoose.Schema({
    tokenAddress: {
        type: String,
        required: true
    },
    pair: {
        type: String,
        required: true
    },
    symbol: {
        type: String,
        required: true
    },
    decimals: {
        type: Number,
        required: true
    },
    buyTax: {
        type: Number,
    },
    sellTax: {
        type: Number,
    },
    honeypot: {
        type: Boolean,
    },
    updateFrom3rdAt: {
        type: Number,
        required: true
    },
    updateAt: {
        type: Number,
        required: true
    }

})

module.exports = mongoose?.model('Tokendata', TokendataSchema);