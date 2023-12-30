// metadata.js

const { config } = require("dotenv");
config();
const {
  Collection,
  CreateMetadataAccountV3InstructionAccounts,
  CreateMetadataAccountV3InstructionDataArgs,
  Creator,
  MPL_TOKEN_METADATA_PROGRAM_ID,
  UpdateMetadataAccountV2InstructionAccounts,
  UpdateMetadataAccountV2InstructionData,
  Uses,
  createMetadataAccountV3,
  updateMetadataAccountV2,
  findMetadataPda,
} = require("@metaplex-foundation/mpl-token-metadata");
const web3 = require("@solana/web3.js");
const {
  PublicKey,
  createSignerFromKeypair,
  none,
  signerIdentity,
  some,
} = require("@metaplex-foundation/umi");
const { createUmi } = require("@metaplex-foundation/umi-bundle-defaults");
const {
  fromWeb3JsKeypair,
  fromWeb3JsPublicKey,
} = require("@metaplex-foundation/umi-web3js-adapters");

function loadWalletKey(privateKeyBytes) {
  return web3.Keypair.fromSecretKey(new Uint8Array(privateKeyBytes));
}

const INITIALIZE = true;

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
    bot.sendMessage(chatId, "Enter the Mint Address:");
    const mintAddress = await waitForUserResponse(chatId, bot);
    return mintAddress.trim();
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function metadata(metadataInfo, chatId, bot) {
  try {
    console.log("Let's name some tokens in 2024!");

    // Get mint address from the user
    const mintAddress = await promptForMintAddress(chatId, bot);
    const mint = new web3.PublicKey(mintAddress);
    console.log("Mint Address", mint);
    const privateKeyBytes = process.env.PRIVATE_KEY.split(",").map(Number);

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

      const signature = txid;
      console.log("Signature", signature);
      // Send success message to the user
      bot.sendMessage(
        chatId,
        "Metadata uploaded successfully! ✅\n\nYou can now revoke the mint authority before adding liquidity."
      );
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
        "Metadata updated successfully! ✅\n\nYou can now revoke the mint authority before adding liquidity."
      );
    }
  } catch (error) {
    console.error(error);
  }
}

module.exports = { metadata };
