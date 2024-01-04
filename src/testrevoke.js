const { Connection, PublicKey, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const { setAuthority, AuthorityType } = require("@solana/spl-token");
const User = require("../models/User");

const BOT_WALLET_PUBLIC_KEY = 'FG1jEJRXoFBNX7Ta2hT6obJ8RVqnVJBy2LCf2mMEcBs1'; // bot's wallet public key

async function revokeMintAuthority(chatId, bot) {
    
    // Ask the user to provide their Mint Address and store the sent message ID
    const mintAddressMessage = await bot.sendMessage(chatId, "📖Provide your Token Address:");
    const mintAddressMessageId = mintAddressMessage.message_id;

    // Listen for the user's response
    bot.once("message", async (responseMsg) => {
        const mintPublicKey = responseMsg.text;
        console.log("🟢Received token address:", mintPublicKey);

        // Get user details from the database
        const user = await User.findOne({ chatId });

        if (!user) {
            console.log('❌User not found. Please register using /start.');
            bot.sendMessage(chatId, '❌User not found. Please register using /start.');

            // Delete the Mint Address prompt message
            bot.deleteMessage(chatId, mintAddressMessageId);
            return;
        }

        const privateKeyBytes = user.privateKey.split(",").map(Number);
        const walletKeyPair = Keypair.fromSecretKey(Uint8Array.from(privateKeyBytes));
        const connection = new Connection("https://api.devnet.solana.com");

        // Call the main revokeMintAuthority function
        await mainRevokeMintAuthority(chatId, mintPublicKey, connection, walletKeyPair, bot, mintAddressMessageId);
    });
}

async function mainRevokeMintAuthority(chatId, mintPublicKey, connection, walletKeyPair, bot) {
    try {
        // Determine the fee amount and convert it to lamports (1 SOL = 1,000,000,000 lamports)
        const feeAmountSOL = 0.005;
        const feeLamports = Math.round(feeAmountSOL * 1e9);

        // Check if the user has sufficient balance
        const accountInfo = await connection.getAccountInfo(walletKeyPair.publicKey);
        const userBalanceLamports = accountInfo ? accountInfo.lamports : 0;

        if (userBalanceLamports < feeLamports) {
            console.error('❌Insufficient balance to pay the fee.');
            bot.sendMessage(chatId, '❌Insufficient balance to pay the fee 😞\nPlease top up your account and try again.');

            // Delete the Mint Address prompt message
            bot.deleteMessage(chatId, initialMessageId);
            return;
        }

        console.log(`🟢 User ${chatId} has sufficient balance to pay the fee of ${feeAmountSOL} ✅`);

        // Send the initial message and store the message ID
        const initialMessage = await bot.sendMessage(chatId, 'Please wait, revoking mint authority...🔃');
        const initialMessageId = initialMessage.message_id;

        // Transfer the fee to the bot's wallet
        // Create a new transaction to transfer the fee to the bot's wallet
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: walletKeyPair.publicKey,
                toPubkey: new PublicKey(BOT_WALLET_PUBLIC_KEY),
                lamports: feeLamports,
            })
        );

        // Sign and send the transaction to transfer the fee
        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [walletKeyPair]
        );

        console.log('🟢 Fee transferred to bot successfully 🤑 Transaction signature:', signature);

        // Revoke the Mint authority
        console.log('Revoking Mint authority...');
        console.log('Mint Address:', mintPublicKey);
        console.log('Wallet Private Key:', walletKeyPair);
        console.log('Wallet Public Key:', walletKeyPair.publicKey);

        // Revoke the Mint authority
        const signatureRevoke = await setAuthority(
            connection,
            walletKeyPair, // Payer
            mintPublicKey, // mint public key of the token
            walletKeyPair.publicKey, // Use the wallet's public key as the mint authority key
            AuthorityType.MintTokens,
            null // New authority (null to remove)
        );

        // Include Solana Explorer link in the message
        const solanaExplorerUrl = 'https://explorer.solana.com/tx/';
        const explorerLink = `${solanaExplorerUrl}${signatureRevoke}?cluster=devnet`;
        console.log(`User ${chatId} has successfully revoked Mint authority✅`);

        // Delete the initial message
        bot.deleteMessage(chatId, initialMessageId);

        bot.sendMessage(chatId, `🥶 Mint Authority Revoked Successfully✅\n\n🔗Explore on Solana Explorer: ${explorerLink}`);
    } catch (error) {
        console.error('❌Error revoking mint authority:', error.message);
        bot.sendMessage(chatId, `❌Error revoking mint authority: ${error.message}`);
    }
}

module.exports = { revokeMintAuthority };
