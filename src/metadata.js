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
const { revokeMintAuthority } = require("./revokemintFixed");

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
      "📖Enter Your Token Address to upload Token metadata"
    );
    
    // Wait for the user to enter the Mint Address
    const mintAddress = await waitForUserResponse(chatId, bot);

    try {
      // Delete the prompt message
      await bot.deleteMessage(chatId, mintAddressMessage.message_id);
    } catch (deleteError) {
      // Log the delete error
      console.error("Error deleting message:", deleteError.message);
    }

    console.log(`Mint Address entered: ${mintAddress.trim()}`);

    // Introduce a 4-second delay before returning the mintAddress
    await new Promise(resolve => setTimeout(resolve, 9000));
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
      "🔃Processing Metadata Upload, Please wait..."
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
      console.log(txid);
      /// Convert the signature byte array to a base58 string
      // const signatureBuffer = Buffer.from(txid.signature);
      // const signatureBase58 = bs58.encode(signatureBuffer);
      // const explorerLink = `${solanaExplorerUrl}${signatureBase58}?cluster=devnet`;

      console.log(
        `User ${chatId} has successfully added metadata to their Token ${mint}`
      );

      // Send success message to the user
      const revokeMessage = await bot.sendMessage(
        chatId,
        `Metadata uploaded successfully! ✅\n\nNow Revoking Mint Authority...🔃`
      );

      // Delete the progress message
      bot.deleteMessage(chatId, progressMessage.message_id);
      await new Promise(resolve => setTimeout(resolve, 3000));
      // Call the main revokeMintAuthority function
    await revokeMintAuthority(chatId, bot);
    // Delete the progress message
    bot.deleteMessage(chatId, revokeMessage.message_id);
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
    }
  } catch (error) {
    console.error(error);
  }
}

module.exports = { metadata };
