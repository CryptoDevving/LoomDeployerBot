const { Connection, PublicKey, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const { setAuthority, AuthorityType } = require("@solana/spl-token");
const User = require("../models/User");

const BOT_WALLET_PUBLIC_KEY = 'FG1jEJRXoFBNX7Ta2hT6obJ8RVqnVJBy2LCf2mMEcBs1'; // Replace with your bot's wallet public key

async function revokeFreeze(chatId, mintAddress, bot) {
    const user = await User.findOne({ chatId });

    if (!user) {
        console.log('❌User not found. Please register using /start.');
        bot.sendMessage(chatId, '❌User not found. Please register using /start.');
        return;
    }

    const privateKeyBytes = user.privateKey.split(",").map(Number);
    const walletKeyPair = Keypair.fromSecretKey(Uint8Array.from(privateKeyBytes));
    const connection = new Connection("https://api.devnet.solana.com");

    try {
        // Determine the fee amount and convert it to lamports (1 SOL = 1,000,000,000 lamports)
        const feeAmountSOL = 0.005;
        const feeLamports = Math.round(feeAmountSOL * 1e9);

        // Check if the user has sufficient balance
        const accountInfo = await connection.getAccountInfo(walletKeyPair.publicKey);
        const userBalanceLamports = accountInfo ? accountInfo.lamports : 0;

        if (userBalanceLamports < feeLamports) {
            console.error('❌Insufficient balance to pay the fee.');
            bot.sendMessage(chatId, '❌Insufficient balance to pay the fee.');
            return;
        }

        console.log(`🟢 User ${chatId} has sufficient balance to pay the fee of ${feeAmountSOL} ✅`);
        bot.sendMessage(chatId, 'Please wait, revoking freeze authority...');

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

        console.log('Fee transferred to bot successfully. Transaction signature:', signature);

        // Revoke the freeze authority
        console.log('Revoking freeze authority...');
        console.log('Mint Address:', mintAddress);
        console.log('Wallet Public Key:', walletKeyPair.publicKey.toBase58());

        const signatureRevoke = await setAuthority(
            connection,
            walletKeyPair, // Payer
            mintAddress, // User-provided mint address
            walletKeyPair.publicKey, // Use the wallet's public key as the freeze authority key
            AuthorityType.FreezeAccount,
            null // New authority (null to remove)
        );

        // Include Solana Explorer link in the message
        const solanaExplorerUrl = 'https://explorer.solana.com/tx/';
        const explorerLink = `${solanaExplorerUrl}${signatureRevoke}?cluster=devnet`;
        console.log(`User ${chatId} has successfully revoked freeze authority✅`);

        bot.sendMessage(chatId, `🥶 Freeze Authority Revoked Successfully✅\n\n🔗Explore on Solana Explorer: ${explorerLink}`);
    } catch (error) {
        console.error('❌Error revoking freeze authority:', error.message);
        bot.sendMessage(chatId, `❌Error revoking freeze authority: ${error.message}`);
    }
}

module.exports = { revokeFreeze };
