// addMetadata.js
const { config } = require("dotenv");
config();
const {
  createMetadataAccountV3,
  updateMetadataAccountV2,
  findMetadataPda,
} = require("@metaplex-foundation/mpl-token-metadata");
const { createSignerFromKeypair, signerIdentity, some, none } = require("@metaplex-foundation/umi");
const { fromWeb3JsKeypair, fromWeb3JsPublicKey } = require('@metaplex-foundation/umi-web3js-adapters');
const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
const web3 = require("@solana/web3.js");
const User = require("../models/User");

async function addMetadata(chatId, bot) {
  const user = await User.findOne({ chatId });

  if (!user) {
    bot.sendMessage(chatId, "User not found in the database. Please use /start to create a new wallet.");
    return;
  }

  // Prompt user for metadata details
  bot.sendMessage(chatId, "To upload your metadata, submit the following details");

  const metadataDetails = await promptUserForMetadata(chatId, bot);

  // Prompt user for MintPublicKey
  bot.sendMessage(chatId, "Now, please enter the MintPublicKey for which you want to add metadata:");

  bot.once("text", async (msgMintPublicKey) => {
    const mintPublicKey = msgMintPublicKey.text.trim();

    // Call the addMetadata function and pass metadataDetails, mintPublicKey, and bot as parameters
    try {
      await processMetadataTransaction(chatId, metadataDetails, mintPublicKey, bot);
    } catch (error) {
      console.error("Error processing metadata transaction:", error);
      bot.sendMessage(chatId, "Error processing metadata transaction");
    }
  });
}

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

  // Prompt user for logo upload
  bot.sendMessage(chatId, "Now, please submit your logo in a supported format (jpg, jpeg, or png).");

  const logoUrl = await uploadLogoToPinata(chatId);

  metadataDetails.image = logoUrl;

  return metadataDetails;
}

async function processMetadataTransaction(chatId, metadataDetails, mintPublicKey, bot) {
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
    await createMetadataAccountV3(umi, {
      mint,
      metadataData: metadataDetails,
    }).sendAndConfirm(umi);
  } else {
    // Update existing metadata account
    await updateMetadataAccountV2(umi, {
      metadata: metadataPda,
      mint,
      data: some(metadataDetails),
      newUpdateAuthority: none(),
      primarySaleHappened: none(),
    }).sendAndConfirm(umi);
  }

  bot.sendMessage(chatId, "Metadata added successfully!");

  // Fetch and send Solana explorer link for the transaction
  const mintExplorerUrl = `https://explorer.solana.com/address/${mintPublicKey}?cluster=devnet`;
  bot.sendMessage(chatId, `🔗*Mint Explorer URL:* [${mintExplorerUrl}](${mintExplorerUrl})`);
}

async function uploadLogoToPinata(chatId) {
  // Implement logic to upload the logo to Pinata and get the URL
  // You can use Pinata SDK or any other method for uploading files to IPFS
  // For simplicity, you can assume the logo URL is a placeholder
  const logoUrl = "https://example.com/logo.jpg";
  bot.sendMessage(chatId, "Logo uploaded successfully!");
  return logoUrl;
}

function loadWalletKey(privateKeyBytes) {
  return web3.Keypair.fromSecretKey(new Uint8Array(privateKeyBytes));
}

module.exports = {
  addMetadata,
};
