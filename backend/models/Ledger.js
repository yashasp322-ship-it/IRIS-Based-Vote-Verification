const mongoose = require('mongoose');

const ledgerSchema = new mongoose.Schema({
    tracking_hash: {
        type: String,
        required: true,
        unique: true
    },
    timestamp: {
        type: Number,
        required: true
    },
    block_index: {
        type: Number,
        required: true
    },
    ballot_data: {
        type: mongoose.Schema.Types.Mixed, // accepts string or object
        required: true
    }
});

module.exports = mongoose.model('Ledger', ledgerSchema);
