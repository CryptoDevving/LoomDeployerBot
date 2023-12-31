// metadata.js

const { config } = require("dotenv");
config();
const {
  createMetadataAccountV3,
  updateMetadataAccountV2,
  findMetadataPda,
} = require("@metaplex-foundation/mpl-token-metadata");
const web3 = require("@solana/web3.js");
const {
  createSignerFromKeypair,
  none,
  signerIdentity,
  some,
} = require("@metaplex-foundation/umi");
const { createUmi } = require("@metaplex-foundation/umi-bundle-defaults");
const {
  fromWeb3JsKeypair,
} = require("@metaplex-foundation/umi-web3js-adapters");
const bs58 = require('bs58');
const User = require("../models/User");

function loadWalletKey(privateKeyBytes) {
  return web3.Keypair.fromSecretKey(new Uint8Array(privateKeyBytes));
}

const INITIALIZE = true;
const solanaExplorerUrl = "https://explorer.solana.com/tx/";

// Function to wait for user response
async function waitForUserResponse(chatId, bot) {
  return new Promise((resolve) => {
    bot.once("message", (msg) => {
      if (msg.chat.id.toString() === chatId.toString()) {
        resolve(msg.text);
      }
    });
  });
}

async function promptForMintAddress(chatId, bot) {
  try {
    // Send the prompt message
    const mintAddressMessage = await bot.sendMessage(
      chatId,
      "Enter the Mint Address:"
    );
    // Wait for the user to enter the Mint Address
    const mintAddress = await waitForUserResponse(chatId, bot);
    // Delete the prompt message
    bot.deleteMessage(chatId, mintAddressMessage.message_id);

    return mintAddress.trim();
  } catch (error) {
    console.error(error);
    return null;
  }
}

// Function to add metadata
async function metadata(metadataInfo, chatId, bot) {
  try {
    console.log(`User ${chatId} wants to add metadata to their Token`);

    // Get the user from the database based on the chatId
    const user = await User.findOne({ chatId });
    if (!user) {
      // Handle the case where the user is not found
      console.error("User not found");
      return;
    }

    // Get mint address from the user
    const mintAddress = await promptForMintAddress(chatId, bot);
    const mint = new web3.PublicKey(mintAddress);
    const privateKeyBytes = user.privateKey.split(",").map(Number);

    // Display a progress message to the user
    const progressMessage = await bot.sendMessage(
      chatId,
      "Processing. Please wait..."
    );

    const umi = createUmi("https://api.devnet.solana.com");
    const signer = createSignerFromKeypair(
      umi,
      fromWeb3JsKeypair(loadWalletKey(privateKeyBytes))
    );
    umi.use(signerIdentity(signer, true));

    const onChainData = {
      ...metadataInfo,
      sellerFeeBasisPoints: 0,
      creators: none(),
      collection: none(),
      uses: none(),
    };

    if (INITIALIZE) {
      const accounts = {
        mint: mint,
        mintAuthority: signer,
      };
      const data = {
        isMutable: true,
        collectionDetails: null,
        data: onChainData,
      };
      const txid = await createMetadataAccountV3(umi, {
        ...accounts,
        ...data,
      }).sendAndConfirm(umi);

      /// Convert the signature byte array to a base58 string
      const signatureBuffer = Buffer.from(txid.signature);
      const signatureBase58 = bs58.encode(signatureBuffer);
      const explorerLink = `${solanaExplorerUrl}${signatureBase58}?cluster=devnet`;

      console.log(
        `User ${chatId} has successfully added metadata to their Token ${mint}\n🔗View on Explorer: ${explorerLink}`
      );

      // Send success message to the user
      bot.sendMessage(
        chatId,
        `Metadata uploaded successfully! ✅\n\nYou can now revoke authority before adding liquidity using the /revokefreeze command. \n\n🔗View on Explorer: ${explorerLink}`
      );

      // Delete the progress message
      bot.deleteMessage(chatId, progressMessage.message_id);
    } else {
      const data = {
        data: some(onChainData),
        discriminator: 0,
        isMutable: some(true),
        newUpdateAuthority: none(),
        primarySaleHappened: none(),
      };
      const accounts = {
        metadata: findMetadataPda(umi, { mint: mint }),
        updateAuthority: signer,
      };
      const txid = await updateMetadataAccountV2(umi, {
        ...accounts,
        ...data,
      }).sendAndConfirm(umi);
      console.log(txid);
      // Send success message to the user
      bot.sendMessage(
        chatId,
        "Metadata updated successfully! ✅\n\nYou can now revoke authority before adding liquidity using the /revokefreeze command."
      );

      // Delete the progress message
      bot.deleteMessage(chatId, progressMessage.message_id);
    }
  } catch (error) {
    console.error(error);
  }
}

module.exports = { metadata };
