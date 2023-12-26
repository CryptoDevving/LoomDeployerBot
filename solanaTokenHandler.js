const { Keypair } = require('@solana/web3.js');
const web3 = require('@solana/web3.js');
const {
  getMinimumBalanceForRentExemptMint,
  createInitializeMintInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction
} = require('@solana/spl-token');
const {
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID
} = require('@metaplex-foundation/mpl-token-metadata');

async function createToken(tokenDetails, solanaPublicKey, solanaPrivateKey, chatId) {
  try {
    // Set up Solana connection
    const connection = new web3.Connection('https://api.devnet.solana.com', 'confirmed');

    // Retrieve user keypair from private key
    const userKeypair = new Keypair(Uint8Array.from(solanaPrivateKey));

    // Object to store token details
    const form = {
      tokenName: tokenDetails.name,
      symbol: tokenDetails.symbol,
      metadata: tokenDetails.logo, // Assuming logo is the metadata for simplicity
      amount: Number(tokenDetails.amount),
      decimals: Number(tokenDetails.decimal),
    };

    const lamports = await getMinimumBalanceForRentExemptMint(connection);
    const mintKeypair = Keypair.generate();

    const tokenATA = await getAssociatedTokenAddress(mintKeypair.publicKey, userKeypair.publicKey);

    const createMetadataInstruction = createCreateMetadataAccountV3Instruction(
      {
        metadata: web3.PublicKey.findProgramAddressSync(
          [
            Buffer.from("metadata"),
            PROGRAM_ID.toBuffer(),
            mintKeypair.publicKey.toBuffer(),
          ],
          PROGRAM_ID,
        )[0].toString(),
        mint: mintKeypair.publicKey,
        mintAuthority: userKeypair.publicKey,
        payer: userKeypair.publicKey,
        updateAuthority: userKeypair.publicKey,
      },
      {
        createMetadataAccountArgsV3: {
          data: {
            name: form.tokenName,
            symbol: form.symbol,
            uri: form.metadata,
            creators: null,
            sellerFeeBasisPoints: 0,
            uses: null,
            collection: null,
          },
          isMutable: false,
          collectionDetails: null,
        },
      },
    );

    const createNewTokenTransaction = new web3.Transaction().add(
      web3.SystemProgram.createAccount({
        fromPubkey: userKeypair.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: web3.MINT_SIZE,
        lamports: lamports,
        programId: web3.TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        form.decimals,
        userKeypair.publicKey,
        userKeypair.publicKey,
        web3.TOKEN_PROGRAM_ID
      ),
      createAssociatedTokenAccountInstruction(
        userKeypair.publicKey,
        tokenATA,
        userKeypair.publicKey,
        mintKeypair.publicKey,
      ),
      createMintToInstruction(
        mintKeypair.publicKey,
        tokenATA,
        userKeypair.publicKey,
        form.amount * Math.pow(10, form.decimals),
      ),
      createMetadataInstruction
    );

    await connection.sendTransaction(createNewTokenTransaction, [userKeypair]);
    console.log('Token creation successful!');
  } catch (error) {
    console.error('Error creating token:', error);
    throw new Error('Error creating token. Please try again.');
  }
}

module.exports = { createToken };
