const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true
  },
  voterId: {
    type: String,
    required: true,
    unique: true
  },
  hasVoted: {
    type: Boolean,
    default: false
  },
  irisTemplate: {
    type: Buffer,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', UserSchema);