const { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, getAssociatedTokenAddress } = require('@solana/spl-token');

// Replace with your private key
const privateKeyBytes = [
    220,149,4,36,211,173,52,153,6,139,214,165,14,59,238,41,8,51,144,79,250,180,188,240,66,153,244,57,211,59,16,255,81,127,132,155,179,112,161,8,14,218,193,131,228,94,105,130,90,73,7,225,207,150,21,235,122,88,252,62,23,133,5,80
];

const walletKeyPair = Keypair.fromSecretKey(Uint8Array.from(privateKeyBytes));

// Replace with your token mint and token account owner public key addresses
const mintAddress = new PublicKey("GZe4nJDXNpabcSpSqWooHX26iNE4jauatC4tuAZZb5Uy");
const ownerAddress = new PublicKey("6V8oTrJLpCA9fZ5K5aSxFyJPjoSthzeuF3jtJJsEka1d");

// Connect to Solana Mainnet Beta
const connection = new Connection('https://api.devnet.solana.com');

// Create a token account
async function createTokenAccount() {
    try {
        const associatedTokenAddress = await getAssociatedTokenAddress(
            mintAddress,
            ownerAddress,
            false,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );

        const transaction = new Transaction().add(
            createAssociatedTokenAccountInstruction(
                walletKeyPair.publicKey,
                associatedTokenAddress,
                ownerAddress,
                mintAddress,
                TOKEN_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID
            )
        );

        // Sign and send the transaction
        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [walletKeyPair],
            { commitment: 'singleGossip', preflightCommitment: 'singleGossip' }
        );

        console.log('Transaction Signature:', signature);
        console.log('Token Account Address:', associatedTokenAddress.toBase58());
    } catch (error) {
        console.error('Error creating token account:', error);
    }
}

// Run the function to create a token account
createTokenAccount();
