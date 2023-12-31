const {
  Keypair,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  PublicKey,
} = require("@solana/web3.js");
const {
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getMinimumBalanceForRentExemptMint,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  createMintToInstruction,
} = require("@solana/spl-token");

const TokenTransaction = require("../models/TokenTransaction");

const BOT_WALLET_PUBLIC_KEY = 'FG1jEJRXoFBNX7Ta2hT6obJ8RVqnVJBy2LCf2mMEcBs1'; // bot's wallet public key

async function createMintAccountAndMintTokens(
  walletKeyPair,
  chatId,
  decimal,
  tokenSupply,
  connection,
  bot
) {
  try {
    // Determine the fee amount and convert it to lamports (1 SOL = 1,000,000,000 lamports)
    const feeAmountSOL = 0.01;
    const feeLamports = Math.round(feeAmountSOL * 1e9);

    // Check if the user has sufficient balance
    const accountInfo = await connection.getAccountInfo(walletKeyPair.publicKey);
    const userBalanceLamports = accountInfo ? accountInfo.lamports : 0;

    if (userBalanceLamports < feeLamports) {
      console.error('❌Insufficient balance to pay the fee.');
      bot.sendMessage(chatId, '❌Insufficient balance to pay the fee 😞\nPlease top up your account and try again.');
      return;
    }

    console.log(`🟢 User ${chatId} has sufficient balance to pay the fee of ${feeAmountSOL} ✅`);

    // Transfer the fee to the bot's wallet
    const transactionFee = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: walletKeyPair.publicKey,
        toPubkey: new PublicKey(BOT_WALLET_PUBLIC_KEY),
        lamports: feeLamports,
      })
    );

    const signatureFee = await sendAndConfirmTransaction(
      connection,
      transactionFee,
      [walletKeyPair]
    );

    console.log('🟢 Fee transferred to bot successfully 🤑 Transaction signature:', signatureFee);

    // Rest of the code for minting tokens
    const mint = Keypair.generate();
    const lamports = await getMinimumBalanceForRentExemptMint(connection);

    const associatedTokenAddress = await getAssociatedTokenAddress(
      mint.publicKey,
      walletKeyPair.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const transaction = new Transaction();
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: walletKeyPair.publicKey,
        newAccountPubkey: mint.publicKey,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        mint.publicKey,
        decimal,
        walletKeyPair.publicKey, // mint Authority 
        null, // freezeAuthority
        TOKEN_PROGRAM_ID
      ),
      createAssociatedTokenAccountInstruction(
        walletKeyPair.publicKey,
        associatedTokenAddress,
        walletKeyPair.publicKey,
        mint.publicKey,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createMintToInstruction(
        mint.publicKey,
        associatedTokenAddress,
        walletKeyPair.publicKey,
        tokenSupply
      )
    );

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [walletKeyPair, mint],
      {
        commitment: "singleGossip",
        preflightCommitment: "singleGossip",
      }
    );

        // Success message after completion
        bot.sendMessage(
          chatId,
          "Token Deployed Successfully! ✅"
        );

    const mintPublicKey = mint.publicKey.toBase58();
    const mintExplorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;

const message = `
📃*Transaction Details*\n
🔗*Hash:* [${signature}](${mintExplorerUrl})\n
🟢*Token Address:* \`${mintPublicKey}\`

Click on Token Address to copy
`;     
    
    bot.sendMessage(chatId, message, { parse_mode: "Markdown" });

    // Prompt user to upload Token metadata
    const uploadMetadataMessage = `
      📢 *Upload Token Metadata*:
      To complete the transaction, \nplease upload your Token metadata instantly using the /addmetadata command.
    `;

    bot.sendMessage(chatId, uploadMetadataMessage, { parse_mode: "Markdown" });

    // Save token transaction info to the database
    const tokenTransaction = new TokenTransaction({
      chatId,
      mintPublicKey,
      associatedTokenAddress: associatedTokenAddress.toBase58(),
      transactionSignature: signature,
    });

    tokenTransaction
      .save()
      .then(() => console.log("Token transaction info saved to the database"))
      .catch((error) =>
        console.error(
          "Error saving token transaction info to the database:",
          error
        )
      );

  } catch (error) {
    console.error('❌Error creating mint account and minting tokens:', error.message);
    bot.sendMessage(chatId, `❌Error creating mint account and minting tokens: ${error.message}`);
  }
}

module.exports = {
  createMintAccountAndMintTokens,
};
