const Arweave = require('arweave');

// Connect to the Arweave network
const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
});

// Your Solana token metadata as a JSON object
const solanaTokenMetadata = {
  name: "GUDS",
  symbol: "GUDS",
  decimals: 9,
  description: "A test token for GUDS",
  image: "https://wos4qmv7zzcu343kkvwdugn6l7fqhb2vcjvibhhb4snfzqdpjq2a.arweave.net/s6XIMr_ORU3zalVsOhm-X8sDh1USaoCc4eSaXMBvTDQ?ext=png"
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
