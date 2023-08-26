const mongoose = require('mongoose');

const InteractionSchema = new mongoose.Schema({
    interaction: {
        type: String,
        required: true,
      },
    tokenAddress: {
        type: String,
        required: true
    }
})

module.exports = mongoose?.model('Interaction', InteractionSchema);