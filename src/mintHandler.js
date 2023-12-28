// mintHandler.js

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
  
  const User = require('./models/User');
  const TokenTransaction = require('./models/TokenTransaction');
  
  async function createMintAccountAndMintTokens(connection, decimal, tokenSupply) {
    const chatId = msg.chat.id;
  
    console.log('Numeric Chat ID:', chatId);
  
    const existingUser = await User.findOne({ chatId });
  
    if (!existingUser) {
      throw new Error("User not found in the database.");
    }
  
    // Ensure the privateKey is correctly formatted
    const privateKeyBytes = existingUser.privateKey.split(',').map(Number);
    const connectedWalletKeyPair = Keypair.fromSecretKey(Uint8Array.from(privateKeyBytes));
  
    console.log('Connected Wallet KeyPair:', connectedWalletKeyPair);
  
  
    const mint = Keypair.generate();
    const lamports = await getMinimumBalanceForRentExemptMint(connection);
  
    console.log('Generated Mint KeyPair:', mint); // Added for debugging
    console.log('Minimum Lamports for Mint:', lamports); // Added for debugging
  
    const associatedTokenAddress = await getAssociatedTokenAddress(
      mint.publicKey,
      connectedWalletKeyPair.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
  
    console.log('Associated Token Address:', associatedTokenAddress); // Added for debugging
  
    const transaction = new Transaction();
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: connectedWalletKeyPair.publicKey,
        newAccountPubkey: mint.publicKey,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        mint.publicKey,
        decimal,
        connectedWalletKeyPair.publicKey,
        connectedWalletKeyPair.publicKey,
        TOKEN_PROGRAM_ID
      ),
      createAssociatedTokenAccountInstruction(
        connectedWalletKeyPair.publicKey,
        associatedTokenAddress,
        connectedWalletKeyPair.publicKey,
        mint.publicKey,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createMintToInstruction(
        mint.publicKey,
        associatedTokenAddress,
        connectedWalletKeyPair.publicKey,
        tokenSupply
      )
    );
  
    console.log('Transaction:', transaction); // Added for debugging
  
    const signature = await sendAndConfirmTransaction(connection, transaction, [connectedWalletKeyPair, mint], {
      commitment: "singleGossip",
      preflightCommitment: "singleGossip",
    });
  
    console.log('Transaction Signature:', signature); // Added for debugging
  
    const mintPublicKey = mint.publicKey.toBase58();
    const tokenAccountAddress = associatedTokenAddress.toBase58();
  
    console.log('Mint Public Key:', mintPublicKey); // Added for debugging
    console.log('Token Account Address:', tokenAccountAddress); // Added for debugging
  
    // Save token transaction info to the database
    const tokenTransaction = new TokenTransaction({
      chatId,
      mintPublicKey,
      associatedTokenAddress: tokenAccountAddress,
      transactionSignature: signature,
    });
  
    tokenTransaction.save()
      .then(() => console.log('Token transaction info saved to the database'))
      .catch((error) => console.error('Error saving token transaction info to the database:', error));
  
    return { signature, mintPublicKey, tokenAccountAddress };
  }  
  
  module.exports = createMintAccountAndMintTokens;
  