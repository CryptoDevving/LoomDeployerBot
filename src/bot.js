const { config } = require("dotenv");
config();
const mongoose = require("mongoose");
const User = require("../models/User");
const { Connection, Keypair } = require("@solana/web3.js");
const { handleTelegramFileUpload } = require("./handleTelegramFileUpload");
const TelegramBot = require("node-telegram-bot-api");
// const bigInt = require('big-integer');
// const { createMintAccountAndMintTokens } = require("./deploy");
// const { createMintAccountAndMintTokens } = require("../deployAutoRevokeMint");
// const { revokeMintAuthority } = require("../revokeMintAuthority");
const { revokeMintAuthority } = require("./testrevoke");


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
console.log("Solana connection initialized... 😍" );

// Handle /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username;
  // Check if the user's wallet already exists in the database
  const existingUser = await User.findOne({ chatId });

  if (existingUser) {
    const deployMessage = await bot.sendMessage(
      chatId,
      "You already have a wallet. \nUse /deploy to create and deploy tokens."
    );

    // Delete the message after a certain timeout (e.g., 5 seconds)
    setTimeout(() => {
      bot.deleteMessage(chatId, deployMessage.message_id);
    }, 5000);
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
      username,
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


// Define a global variable to track deployment status
let isDeploymentInProgress = false;
let deployMessage;

// Handle /deploy command
bot.onText(/\/deploy/, async (msg) => {
  const chatId = msg.chat.id;

  // Check if deployment is already in progress
  if (isDeploymentInProgress) {
    deployMessage = await bot.sendMessage(chatId, "Deployment has been clicked already\nClick continue above to proceed with token deployment...");
    return;
  }

  // Set the deployment flag to true
  isDeploymentInProgress = true;

  // Delete the "Continue" button message
  if (deployMessage) {
    bot.deleteMessage(chatId, deployMessage.message_id);
  }

  // Check if the user's wallet exists in the database
  const user = await User.findOne({ chatId });

  if (!user) {
    bot.sendMessage(
      chatId,
      "User not found in the database. Use /start to create a new wallet."
    );

    // Reset the deployment flag to false
    isDeploymentInProgress = false;
    return;
  }

  try {
    // Send a message with the "Continue" button
    const continueMessage = await bot.sendMessage(
      chatId,
      "⏭Click Continue to Proceed with Token Deployment...",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Continue", callback_data: "continue" }],
          ],
        },
      }
    );

    // Handle inline button callback only once
    bot.once("callback_query", async (query) => {
      const data = query.data;

      if (data === "continue") {
        try {
          // Delete the "Continue" button message
          bot.deleteMessage(chatId, continueMessage.message_id);

          await handleTelegramFileUpload(chatId, bot);
        } catch (error) {
          console.error("Error adding metadata:", error);
          bot.sendMessage(chatId, "Error adding metadata");
        } finally {
          // Reset the deployment flag to false
          isDeploymentInProgress = false;
        }
      }
    });
  } catch (error) {
    console.error("Error handling /deploy command:", error);

    // Reset the deployment flag to false in case of an error
    isDeploymentInProgress = false;
  }
});


// Handle /revokemint command
bot.onText(/\/revokemint/, async (msg) => {
  const chatId = msg.chat.id;

  // Check if the user's wallet exists in the database
  const user = await User.findOne({ chatId });

  if (!user) {
    bot.sendMessage(
      chatId,
      "User not found in the database. Use /start to create a new wallet."
    );
    return;
  }

  try {
    // Call the revokeMintAuthority function
    await revokeMintAuthority(chatId, bot);
  } catch (error) {
    console.error("Error handling /revokemint command:", error);
  }
});
