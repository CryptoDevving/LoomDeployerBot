const { config } = require("dotenv");
const { Connection, Keypair, sendAndConfirmTransaction, PublicKey } = require("@solana/web3.js");
const { setAuthority, AuthorityType } = require("@solana/spl-token");
const TelegramBot = require('node-telegram-bot-api');

// Load environment variables
config();

// Specify the hardcoded mint address
const hardcodedMintAddress = "4FozoMRyMWSUzXcU283ZJTQSpvhHB4MhR5AWHMx2N5zz";

// Specify the hardcoded private key
const hardcodedPrivateKeyBytes = Uint8Array.from([ "YOUR_PRIVATE_KEY" ]);
const hardcodedWalletKeyPair = Keypair.fromSecretKey(hardcodedPrivateKeyBytes);
const hardcodedFreezeAuthorityKey = new PublicKey("5nVpf97HH1JV6kiGSEGiHQZbAoHqGz8Yf7GJZ9U2iN9L");

// Initialize Telegram bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
console.log("Bot started and running... 🤖");

// Listen for the /revokefreeze command
bot.onText(/\/revokefreeze/, async (msg) => {
    const chatId = msg.chat.id;

    const connection = new Connection("https://api.devnet.solana.com");

    try {
        console.log('Setting freeze authority to null...');
        const signature = await setAuthority(
            connection,
            hardcodedWalletKeyPair, // Payer
            hardcodedMintAddress, // Hardcoded mint address
            hardcodedFreezeAuthorityKey, // Current authority
            AuthorityType.FreezeAccount,
            null // New authority (null to remove)
        );

        console.log('Freeze authority set to null. Transaction Signature:', signature);
        bot.sendMessage(chatId, `🥶 Freeze authority set to null. Transaction Signature: ${signature}`);
    } catch (error) {
        console.error('Error setting freeze authority to null:', error.message);
        bot.sendMessage(chatId, `Error setting freeze authority to null: ${error.message}`);
    }
});
