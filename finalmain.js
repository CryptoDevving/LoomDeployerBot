const { Connection, PublicKey, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const {
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getMinimumBalanceForRentExemptMint,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
} = require('@solana/spl-token');

// Replace with your actual connection endpoint
const connection = new Connection('https://api.devnet.solana.com');

// Test private key
const privateKeyBytes = [
  220,149,4,36,211,173,52,153,6,139,214,165,14,59,238,41,8,51,144,79,250,180,188,240,66,153,244,57,211,59,16,255,81,127,132,155,179,112,161,8,14,218,193,131,228,94,105,130,90,73,7,225,207,150,21,235,122,88,252,62,23,133,5,80
];

// Wallet key pair
const walletKeyPair = Keypair.fromSecretKey(Uint8Array.from(privateKeyBytes));

// Function to create a token mint and associated token account
async function createMintAndTokenAccount() {
  try {
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
    
    // Add create mint instruction
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
        9, // decimals
        walletKeyPair.publicKey,
        walletKeyPair.publicKey,
        TOKEN_PROGRAM_ID
      ),
      // Add create associated token account instruction
      createAssociatedTokenAccountInstruction(
        walletKeyPair.publicKey,
        associatedTokenAddress,
        walletKeyPair.publicKey,
        mint.publicKey,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );

    // Sign and send the transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [walletKeyPair, mint],
      { commitment: 'singleGossip', preflightCommitment: 'singleGossip' }
    );

    console.log('Transaction Signature:', signature);
    console.log('Mint Public Key:', mint.publicKey.toBase58());
    console.log('Token Account Address:', associatedTokenAddress.toBase58());
  } catch (error) {
    console.error('Error creating mint and token account:', error);
    throw error; // Propagate the error
  }
}

// Run the function
(async () => {
  try {
    await createMintAndTokenAccount();
  } catch (error) {
    console.error('Error:', error);
  }
})();
