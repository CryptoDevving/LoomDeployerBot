// addMetadata.js
const { config } = require("dotenv");
config();
const { createMetadataAccountV3, updateMetadataAccountV2, findMetadataPda } = require("@metaplex-foundation/mpl-token-metadata");
const { createSignerFromKeypair, signerIdentity, some, none } = require("@metaplex-foundation/umi");
const { fromWeb3JsKeypair, fromWeb3JsPublicKey } = require('@metaplex-foundation/umi-web3js-adapters');
const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
const web3 = require("@solana/web3.js");
const User = require("../models/User");
const axios = require("axios");
const fs = require('fs');

// Use the JWT key
const pinataSDK = require('@pinata/sdk');
const pinata = new pinataSDK({ pinataJWTKey: process.env.PINATA_JWT });
const pinataApiKey = process.env.PINATA_API_KEY;
const pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY;

async function addMetadata(chatId, bot) {
  const user = await User.findOne({ chatId });

  if (!user) {
    bot.sendMessage(chatId, "User not found in the database. Please use /start to create a new wallet.");
    return;
  }

   await pinata.testAuthentication();
  console.log("Pinata Authentication Successful🤗");

  // Prompt user for metadata details
  bot.sendMessage(chatId, "To upload your metadata, submit the following details");

  const metadataDetails = await promptUserForMetadata(chatId, bot);

  // Prompt user for MintPublicKey
  bot.sendMessage(chatId, "Now, please enter the MintPublicKey for which you want to add metadata:");

  bot.once("text", async (msgMintPublicKey) => {
    const mintPublicKey = msgMintPublicKey.text.trim();

    if (!pinataApiKey || !pinataSecretApiKey) {
      bot.sendMessage(chatId, "Pinata API key or secret key is missing. Please check your environment configuration.");
      return;
    }

    // Call the addMetadata function and pass metadataDetails, mintPublicKey, and bot as parameters
    try {
      await processMetadataTransaction(chatId, metadataDetails, mintPublicKey, bot);
    } catch (error) {
      console.error("Error processing metadata transaction:", error);
      bot.sendMessage(chatId, "Error processing metadata transaction");
    }
  });
}

// Update the function call in promptUserForMetadata
async function promptUserForMetadata(chatId, bot) {
  const prompts = ["Token Name", "Token Symbol", "Description"];
  const metadataDetails = {};

  for (const prompt of prompts) {
    bot.sendMessage(chatId, prompt);
    const response = await new Promise((resolve) => {
      bot.once("text", (msg) => resolve(msg.text));
    });

    metadataDetails[prompt.toLowerCase()] = response.trim();
  }

  // Prompt user for file upload
  bot.sendMessage(chatId, "Now, please submit your image in a supported format (jpg, jpeg, png).");

  return metadataDetails;
}


// Update the function call in processMetadataTransaction
async function processMetadataTransaction(chatId, metadataDetails, mintPublicKey, bot, imageBuffer, imageMessage) {
  try {
    // Upload Logo to Pinata and get the URL
    const logoUrl = await uploadFileToPinata(chatId, imageBuffer, imageMessage, bot);
    if (!logoUrl) {
      return;
    }

    // Create metadata JSON
    const metadataJson = {
      name: metadataDetails.name,
      symbol: metadataDetails.symbol,
      description: metadataDetails.description,
      image: logoUrl,
    };

    // Upload JSON to Pinata
    const jsonCid = await uploadJsonToPinata(chatId, metadataJson);
    if (!jsonCid) {
      bot.sendMessage(chatId, "Error uploading metadata JSON to Pinata");
      return;
    }

    // Extract the private key from the database user
    const user = await User.findOne({ chatId });
    const privateKeyBytes = user.privateKey.split(",").map(Number);
    const umi = createUmi("https://api.devnet.solana.com");
    const signer = createSignerFromKeypair(
      umi,
      fromWeb3JsKeypair(loadWalletKey(privateKeyBytes))
    );
    umi.use(signerIdentity(signer, true));

    const mint = new web3.PublicKey(mintPublicKey);
    const metadataPda = findMetadataPda(umi, { mint });
    const metadataAccount = await metadataPda.getAccount();

    if (!metadataAccount) {
      // Create new metadata account

      // Create metadata with the JSON CID
      await createMetadataAccountV3(umi, {
        mint,
        metadataData: {
          ...metadataDetails,
          uri: `https://gateway.pinata.cloud/ipfs/${jsonCid}`,
        },
      }).sendAndConfirm(umi);
    } else {
      // Update existing metadata account
      await updateMetadataAccountV2(umi, {
        metadata: metadataPda,
        mint,
        data: some({
          ...metadataDetails,
          uri: `https://gateway.pinata.cloud/ipfs/${jsonCid}`,
        }),
        newUpdateAuthority: none(),
        primarySaleHappened: none(),
      }).sendAndConfirm(umi);
    }

    bot.sendMessage(chatId, "Metadata added successfully!");

    // Fetch and send Solana explorer link for the transaction
    const mintExplorerUrl = `https://explorer.solana.com/address/${mintPublicKey}?cluster=devnet`;
    bot.sendMessage(chatId, `🔗*Mint Explorer URL:* [${mintExplorerUrl}](${mintExplorerUrl})`);
  } catch (error) {
    console.error("Error processing metadata transaction:", error);
    bot.sendMessage(chatId, "Error processing metadata transaction");
  }
}

// Function to upload JSON to Pinata
async function uploadJsonToPinata(chatId, jsonContent) {
  if (!pinataApiKey || !pinataSecretApiKey) {
    bot.sendMessage(chatId, "Pinata API key is missing. Please check your environment configuration.");
    return null;
  }

  try {
    const response = await pinata.pinJSONToIPFS(jsonContent);
    return response.IpfsHash;
  } catch (error) {
    console.error('Error uploading JSON to Pinata:', error.message);
    bot.sendMessage(chatId, "Error uploading JSON to Pinata");
    return null;
  }
}

// Helper function to load wallet key
function loadWalletKey(privateKeyBytes) {
  return web3.Keypair.fromSecretKey(new Uint8Array(privateKeyBytes));
}

module.exports = {
  addMetadata,
};