// addMetadataModule.js
const path = require("path");
const { metadata } = require('./metadata');

// Function to add metadata
const addMetadata = async (chatId, bot, metadataRes, metadataDetails, metadataFilePath) => {
  try {
    // Define metadata details using the metadata URL
    const metadataInfo = {
      name: metadataDetails.name,
      symbol: metadataDetails.symbol,
      uri: `https://gateway.pinata.cloud/ipfs/${metadataRes.data.IpfsHash}/${path.basename(metadataFilePath)}`,
    };
      await metadata(metadataInfo, chatId, bot);
  } catch (error) {
    console.error(error);
  }
};

module.exports = { addMetadata };
