const mongoose = require('mongoose');

const deployedTokenSchema = new mongoose.Schema({
  ownerId: String, // The user's public key
  tokenName: String,
  tokenSymbol: String,
  tokenSupply: Number,
  tokenLogo: String,
  tokenDescription: String,
  tokenDecimals: Number,
});

const DeployedToken = mongoose.model('DeployedToken', deployedTokenSchema);

module.exports = DeployedToken;
