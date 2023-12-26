const Arweave = require('arweave');

// Connect to the Arweave network
const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
});

// Your Solana token metadata as a JSON object
const solanaTokenMetadata = {
  name: 'Hunter',
  symbol: 'HUNTS',
  description: 'Hunter Token is a meme token',
  image: './logo.jpg',
  decimals: 9,
};

// Convert metadata to JSON string
const metadataString = JSON.stringify(solanaTokenMetadata);

// Function to upload metadata to Arweave
async function uploadMetadata() {
  try {
    // Create an Arweave wallet using a sample key (Replace with your actual key details)
    const wallet = await arweave.wallets.jwkToAddress({
      kty: 'RSA',
      e: 'AQAB',
      n: '...', // Replace with the actual modulus (n) from your seed
      d: '...', // Replace with the actual private exponent (d) from your seed
    });

    // Create a transaction
    const transaction = await arweave.createTransaction({ data: metadataString }, wallet);

    // Sign the transaction with the wallet
    await arweave.transactions.sign(transaction, wallet);

    // Post the transaction
    await arweave.transactions.post(transaction);

    console.log('Metadata uploaded successfully.');
  } catch (error) {
    console.error('Error uploading metadata:', error);
  }
}

// Call the function to upload metadata
uploadMetadata();
