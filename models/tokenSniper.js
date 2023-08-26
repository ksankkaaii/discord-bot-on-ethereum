const mongoose = require('mongoose');

const TokenSniperSchema = new mongoose.Schema({
    discordId: {
        type: String,
        required: true
    },
    isSniping: {
        type: Boolean,
        default: false
    },
    buyAmount: {
        type: String,
        default: `0`,
    },
    requireVerified: {
        type: Boolean,
        default: false
    },
    requireHoneypotCheck: {
        type: Boolean,
        default: false
    },
    requireLiquidityLock: {
        type: Boolean,
        default: false
    },
    allowPrevContracts: {
        type: Boolean,
        default: false
    },
    minimumLiquidity: {
        type: String,
        default: `0`
    },
    maximumBuyTax: {
        type: String,
        default: `0`
    },
    maximumSellTax: {
        type: String,
        default: `0`
    },
    topHolderThreshold: {
        type: String,
        default: `0`
    },
    minimumLockedLiq: {
        type: String,
        default: `0`
    },
})

module.exports = mongoose?.model('TokenSniper', TokenSniperSchema);