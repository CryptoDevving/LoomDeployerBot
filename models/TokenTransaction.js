// models/TokenTransaction.js
const mongoose = require('mongoose');

const tokenTransactionSchema = new mongoose.Schema({
  chatId: {
    type: Number,
    required: true,
  },
  mintPublicKey: {
    type: String,
    required: true,
  },
  associatedTokenAddress: {
    type: String,
    required: true,
  },
  transactionSignature: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const TokenTransaction = mongoose.model('TokenTransaction', tokenTransactionSchema);

module.exports = TokenTransaction;
