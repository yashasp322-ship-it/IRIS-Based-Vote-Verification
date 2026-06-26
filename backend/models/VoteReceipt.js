const mongoose = require('mongoose');

const voteReceiptSchema = new mongoose.Schema({
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
merkle_root: {
  type: String,
  required: true
},
// Preserving original signature field
signature: {
  type: String,
  required: false
}
});

// Update to handle duplicate verification
// Added a reference to Iris ID for uniqueness
module.exports = mongoose.model('VoteReceipt', voteReceiptSchema, 'vote_receipts');