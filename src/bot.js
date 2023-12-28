const { config } = require("dotenv");
config();
const mongoose = require("mongoose");
const User = require("../models/User");
const { Connection, Keypair } = require("@solana/web3.js");
const { createMintAccountAndMintTokens } = require("./deploy");
const TelegramBot = require("node-telegram-bot-api");

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_CONNECTION);

const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB ✅");
});

// Initialize Telegram bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
console.log("Bot started and running... 🤖");

// Initialize Solana connection
const connection = new Connection("https://api.devnet.solana.com");
console.log("Solana connection initialized... 😍");

// Handle /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  // Check if the user's wallet already exists in the database
  const existingUser = await User.findOne({ chatId });

  if (existingUser) {
    bot.sendMessage(
      chatId,
      "You already have a wallet. Use /deploy to create and deploy tokens."
    );
  } else {
    // Generate a new wallet
    const walletKeyPair = Keypair.generate();
    const privateKey = walletKeyPair.secretKey.toString();
    const publicKey = walletKeyPair.publicKey.toBase58();

    bot.sendMessage(chatId, `🔐Your Private Key: ${privateKey}`);
    bot.sendMessage(chatId, `🔑Your Public Key: ${publicKey}`);

    // Save user wallet info to the database
    const user = new User({
      chatId,
      privateKey,
      publicKey,
    });

    user
      .save()
      .then(() => console.log("User wallet info saved to the database"))
      .catch((error) =>
        console.error("Error saving user wallet info to the database:", error)
      );
  }
});

// Handle /deploy command
bot.onText(/\/deploy/, async (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(chatId, "Please enter the decimal for your token:");

  bot.once("text", async (msgDecimal) => {
    const decimal = parseInt(msgDecimal.text);

    bot.sendMessage(chatId, "Please enter the token supply:");

    bot.once("text", async (msgSupply) => {
      const rawTokenSupply = parseInt(msgSupply.text);
      const tokenSupply = rawTokenSupply * Math.pow(10, decimal);

      const user = await User.findOne({ chatId });

      if (user) {
        const privateKeyBytes = user.privateKey.split(",").map(Number);
        const walletKeyPair = Keypair.fromSecretKey(
          Uint8Array.from(privateKeyBytes)
        );

        try {
          // Pass connection and bot instances to the deploy function
          await createMintAccountAndMintTokens(
            walletKeyPair,
            chatId,
            decimal,
            tokenSupply,
            connection,
            bot
          );
        } catch (error) {
          console.error(
            "Error creating mint and token account and minting tokens:",
            error
          );
          bot.sendMessage(
            chatId,
            "Error creating mint and token account and minting tokens"
          );
        }
      } else {
        bot.sendMessage(
          chatId,
          "User not found in the database. Please use /start to create a new wallet."
        );
      }
    });
  });
});
