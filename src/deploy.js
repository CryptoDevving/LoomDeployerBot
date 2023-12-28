const {
    Keypair,
    Transaction,
    SystemProgram,
    sendAndConfirmTransaction,
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

  const TokenTransaction = require('../models/TokenTransaction');
  
  async function createMintAccountAndMintTokens(walletKeyPair, chatId, decimal, tokenSupply, connection, bot) {
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
            walletKeyPair.publicKey,
            walletKeyPair.publicKey,
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
  
    const signature = await sendAndConfirmTransaction(connection, transaction, [walletKeyPair, mint], {
      commitment: "singleGossip",
      preflightCommitment: "singleGossip",
    });
  
    const mintPublicKey = mint.publicKey.toBase58();
    const mintExplorerUrl = `https://explorer.solana.com/address/${mintPublicKey}?cluster=devnet`;
    const transactionExplorerUrl = `https://explorer.solana.com/address/${signature}?cluster=devnet`;
  
    const message = `
  📃*Transaction Details*\n
  ✍*Transaction Signature:* [${signature}](${transactionExplorerUrl})\n
  🔑*Mint Public Key:* [${mintPublicKey}](${mintExplorerUrl})
  `;
  
    // 🔐*Token Account Address:* [${associatedTokenAddress.toBase58()}](${tokenExplorerUrl})
    
    bot.sendMessage(chatId, message, { parse_mode: "Markdown" });

    // Prompt user to upload Token metadata
    const uploadMetadataMessage = `
    📢 *Token Metadata Upload*:
    To complete the transaction, please upload your Token metadata instantly using the /addMetadata command.
    `;

    bot.sendMessage(chatId, uploadMetadataMessage, { parse_mode: "Markdown" });
    
    // Save token transaction info to the database
    const tokenTransaction = new TokenTransaction({
      chatId,
      mintPublicKey,
      associatedTokenAddress: associatedTokenAddress.toBase58(),
      transactionSignature: signature,
    });
  
    tokenTransaction.save()
      .then(() => console.log('Token transaction info saved to the database'))
      .catch((error) => console.error('Error saving token transaction info to the database:', error));
  }
  
  module.exports = {
    createMintAccountAndMintTokens,
  };
  