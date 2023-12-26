const { config } = require('dotenv');
config();

const { Connection, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const {
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getMinimumBalanceForRentExemptMint,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
} = require('@solana/spl-token');
const {
  createMintToInstruction,
} = require('@solana/spl-token');

// Replace with your actual connection endpoint
const connection = new Connection('https://api.devnet.solana.com');

// Load private key from environment variable
const privateKeyBytes = process.env.PRIVATE_KEY.split(',').map(Number);

// Wallet key pair
const walletKeyPair = Keypair.fromSecretKey(Uint8Array.from(privateKeyBytes));

// Function to create a token mint and associated token account and mint tokens
async function createMintAccountAndMintTokens() {
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
      ),
      // Add mint tokens instruction
      createMintToInstruction(
        mint.publicKey,
        associatedTokenAddress,
        walletKeyPair.publicKey,
        100000000000000 // Adjust this based on your token's decimal places
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
    console.log('Minting successful!');
  } catch (error) {
    console.error('Error creating mint and token account and minting tokens:', error);
    throw error; // Propagate the error
  }
}

// Run the function
(async () => {
  try {
    await createMintAccountAndMintTokens();
  } catch (error) {
    console.error('Error:', error);
  }
})();
