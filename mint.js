const {
    Connection,
    PublicKey,
    Keypair,
    Transaction,
    sendAndConfirmTransaction,
  } = require('@solana/web3.js');
  const {
    Token,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    createMintToInstruction,
    getAssociatedTokenAddress,
    getAccount,
  } = require('@solana/spl-token');
  
  // Test private key
  const privateKeyBytes = [
    220,149,4,36,211,173,52,153,6,139,214,165,14,59,238,41,8,51,144,79,250,180,188,240,66,153,244,57,211,59,16,255,81,127,132,155,179,112,161,8,14,218,193,131,228,94,105,130,90,73,7,225,207,150,21,235,122,88,252,62,23,133,5,80
  ];
  
  const walletKeyPair = Keypair.fromSecretKey(Uint8Array.from(privateKeyBytes));
  
  // Connect to Solana Mainnet Beta
  const connection = new Connection('https://api.devnet.solana.com');
  
  // Token Mint Address
  const mintAddress = new PublicKey('Du2f3BfWaeNZvXyYNUPAQdjRQPrevWKBTy5VEzG8FN6e');
  // Recipient Public Key
  const recipientAddress = new PublicKey('6V8oTrJLpCA9fZ5K5aSxFyJPjoSthzeuF3jtJJsEka1d');
  // Amount to mint
  const amount = 100000000000000; // Adjust this based on your token's decimal places
  
  async function mintTokens() {
    try {
      // Get associated token address
      const associatedToken = await getAssociatedTokenAddress(
        mintAddress,
        recipientAddress,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
  
      // Get the current balance of the associated token account
      const initialBalance = Number((await getAccount(connection, associatedToken)).amount);
  
      // Create a transaction to mint tokens
      const transaction = new Transaction().add(
        createMintToInstruction(mintAddress, associatedToken, walletKeyPair.publicKey, amount)
      );
  
      // Log the amount to mint
      console.log('Minting amount:', amount);
  
      // Sign and send the transaction
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [walletKeyPair],
        { commitment: 'singleGossip', preflightCommitment: 'singleGossip' }
      );
  
      // Calculate the updated total balance
      const totalBalance = initialBalance + amount;
  
      // Log both minting amount and updated total balance
      console.log(`Transaction Signature: ${signature} | Minting amount: ${amount} | Updated Total Balance: ${totalBalance}`);
  
      console.log('Minting successful!');
    } catch (error) {
      console.error('Error minting tokens:', error);
    }
  }
  
  // Run the function to mint tokens
  mintTokens();