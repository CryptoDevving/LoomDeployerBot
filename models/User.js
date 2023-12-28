// models/User.js

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  chatId: {
    type: Number, 
    required: true,
  },
  privateKey: {
    type: String,
    required: true,
  },
  publicKey: {
    type: String,
    required: true,
  },
});

const User = mongoose.model('User', userSchema);

module.exports = User;
