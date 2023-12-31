const { config } = require("dotenv");
config();
const mongoose = require("mongoose");
const User = require("../models/User");
const { Connection, Keypair } = require("@solana/web3.js");
const bigInt = require('big-integer');
const { createMintAccountAndMintTokens } = require("./deploy");
const { handleTelegramFileUpload } = require("./handleTelegramFileUpload");
const { revokeFreeze } = require("./RevokeFreezeAuthority");
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

  const decimalMessage = await bot.sendMessage(
    chatId,
    "Please enter the decimal for your token (0-10):"
  );
  bot.once("text", async (msgDecimal) => {
    const decimal = parseInt(msgDecimal.text);

    // Check if the decimal value is within the valid range (0-10)
    if (isNaN(decimal) || decimal < 0 || decimal > 10) {
      console.error('Invalid decimal value. Please enter a valid integer between 0 and 10.');
      bot.sendMessage(chatId, 'Invalid decimal value. Please enter a valid integer between 0 and 10.');
      return;
    }

    // Delete the previous message
    bot.deleteMessage(chatId, decimalMessage.message_id);
    const supplyMessage = await bot.sendMessage(
      chatId,
      "Please enter the token supply\n⚠ Do not enter more than 1.8 Billion (1800000000)\nIf your decimal is 10"
    );
    bot.once("text", async (msgSupply) => {
      const rawTokenSupply = parseInt(msgSupply.text);

      if (isNaN(rawTokenSupply) || rawTokenSupply < 0 || rawTokenSupply > 18000000000000000000n) {
        console.error('Invalid token supply. Please enter a valid integer between 0 and 1800000000');
        bot.sendMessage(chatId, 'Invalid token supply. Please enter a valid integer between 0 and 1800000000');
        return;
      }

      // Perform the multiplication and convert the result to bigInt
      const tokenSupply = bigInt(rawTokenSupply).multiply(bigInt(10).pow(decimal));
      console.log('Token Supply:', tokenSupply.toString());

      bot.deleteMessage(chatId, supplyMessage.message_id);

      const progressMessage = await bot.sendMessage(
        chatId,
        "Deploying Please wait..."
      );

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

          // Delete the progress message
          bot.deleteMessage(chatId, progressMessage.message_id);
        } catch (error) {
          console.error(
            "Error creating mint and token account and minting tokens:",
            error
          );
          bot.sendMessage(
            chatId,
            "Error creating mint and token account and minting tokens"
          );

          // Delete the progress message
          bot.deleteMessage(chatId, progressMessage.message_id);
        }
      } else {
        bot.sendMessage(
          chatId,
          "User not found in the database. Please use /start to create a new wallet."
        );

        // Delete the progress message
        bot.deleteMessage(chatId, progressMessage.message_id);
      }
    });
  });
});

// Handle /addMetadata command
bot.onText(/\/addmetadata/, async (msg) => {
  const chatId = msg.chat.id;

  // Check if the user's wallet exists in the database
  const user = await User.findOne({ chatId });

  if (!user) {
    bot.sendMessage(
      chatId,
      "User not found in the database. Please use /start to create a new wallet."
    );
    return;
  }

  // Send a message with the "Continue" button
  const continueMessage = await bot.sendMessage(
    chatId,
    "Click Continue to start submitting your metadata details:",
    {
      reply_markup: {
        inline_keyboard: [[{ text: "Continue", callback_data: "continue" }]],
      },
    }
  );

  // Handle inline button callback
  bot.on("callback_query", async (query) => {
    const data = query.data;

    if (data === "continue") {
      try {
        // Delete the "Continue" button message
        bot.deleteMessage(chatId, continueMessage.message_id);

        await handleTelegramFileUpload(chatId, bot);
      } catch (error) {
        console.error("Error adding metadata:", error);
        bot.sendMessage(chatId, "Error adding metadata");
      }
    }
  });
});

// Handle /revokefreeze command
bot.onText(/\/revokefreeze/, async (msg) => {
  const chatId = msg.chat.id;

  // Ask the user to provide their Mint Address and store the sent message ID
  const mintAddressMessage = await bot.sendMessage(chatId, "Please provide your Mint Address:");
  const mintAddressMessageId = mintAddressMessage.message_id;

  // Listen for the user's response
  bot.once("message", async (responseMsg) => {
    const mintAddress = responseMsg.text;
    console.log("Received mint address:", mintAddress);

    // Call the revokeFreeze function from revoketest.js
    await revokeFreeze(chatId, mintAddress, bot);

    // Delete the Mint Address prompt message
    bot.deleteMessage(chatId, mintAddressMessageId);
  });
});
