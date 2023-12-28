// main.js
const { config } = require("dotenv");
config();

const {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
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

// Import metadata function from metadata.js
const { metadata } = require("./new");

let mint;

// connection endpoint
const connection = new Connection("https://api.devnet.solana.com");

// Load private key from environment variable
const privateKeyBytes = process.env.PRIVATE_KEY.split(",").map(Number);

// Wallet key pair
const walletKeyPair = Keypair.fromSecretKey(Uint8Array.from(privateKeyBytes));

// Function to create a token mint and associated token account and mint tokens
async function createMintAccountAndMintTokens() {
  try {
    console.log("Let's mint some tokens!");
    mint = Keypair.generate();
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

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [walletKeyPair, mint],
      { commitment: "singleGossip", preflightCommitment: "singleGossip" }
    );

    console.log("Transaction Signature:", signature);
    console.log("Mint Public Key:", mint.publicKey.toBase58());
    console.log("Token Account Address:", associatedTokenAddress.toBase58());

    // Export the mint address
    return mint.publicKey.toBase58();
  } catch (error) {
    console.error("Error during minting:", error);
    throw error;
  }
}

// Call createMintAccountAndMintTokens and get the mint address
createMintAccountAndMintTokens()
  .then((mintAddress) => {
    // Set mint variable
    mint = mintAddress;

    // Call metadata function from metadata.js after minting
    return metadata(mint, mintAddress);
  })
  .catch((error) => {
    console.error(
      "Error creating mint and token account and minting tokens:",
      error
    );
    throw error;
  });
