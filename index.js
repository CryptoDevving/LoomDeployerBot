// index.js
require('dotenv').config();
const web3 = require('@solana/web3.js');
const TelegramBot = require('node-telegram-bot-api');
const { Keypair } = require('@solana/web3.js');
const mongoose = require('mongoose');
const { createToken } = require('./solanaTokenHandler');

// Set up MongoDB connection
mongoose.connect(process.env.MONGODB_CONNECTION, { useNewUrlParser: true, useUnifiedTopology: true });

const User = mongoose.model('User', {
  telegramId: Number,
  solanaPublicKey: String,
  solanaPrivateKey: {
    type: [Number],
    set: function (privateKeyArray) {
      const privateKeyUint8Array = new Uint8Array(privateKeyArray);
      return Array.from(privateKeyUint8Array);
    },
    get: function (privateKeyArray) {
      return Array.from(privateKeyArray);
    },
  },
});

// Set up Solana connection
const connection = new web3.Connection('https://api.devnet.solana.com', 'confirmed');

// Set up Telegram bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Command to handle /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  let user = await User.findOne({ telegramId: userId });

  if (!user) {
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toString();
    const privateKeyArray = Array.from(keypair.secretKey);

    user = new User({
      telegramId: userId,
      solanaPublicKey: publicKey,
      solanaPrivateKey: privateKeyArray,
    });
    await user.save();

    bot.sendMessage(chatId, `Welcome! Your Solana wallet has been created.\nYour public key: ${publicKey}`);
    bot.sendMessage(chatId, `Keep your private key secure. If lost, it cannot be recovered.\nYour encrypted private key: ${privateKeyArray}`);
  } else {
    bot.sendMessage(chatId, `Welcome back! Your Solana wallet already exists.\nYour public key: ${user.solanaPublicKey}`);
  }
});

// Command to handle /deploy
bot.onText(/\/deploy/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const user = await User.findOne({ telegramId: userId });

  if (user) {
    const tokenDetails = {};

    const askForTokenDetails = async (fieldName, prompt) => {
      bot.sendMessage(chatId, prompt);
      return new Promise((resolve) => {
        bot.once('text', async (msg) => {
          tokenDetails[fieldName] = msg.text;
          resolve();
        });
      });
    };

    const askForLogo = async () => {
      return new Promise(async (resolve) => {
        bot.sendMessage(chatId, '3. Upload Token Logo (Accepted formats: .png, .jpg, .jpeg):');

        bot.once('photo', async (msg) => {
          const fileId = msg.photo[msg.photo.length - 1].file_id;
          const fileDetails = await bot.getFile(fileId);

          const fileName = fileDetails.file_path;
          if (fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
            tokenDetails['logo'] = fileName;
            bot.sendMessage(chatId, 'Logo uploaded successfully.');
          } else {
            bot.sendMessage(chatId, 'Invalid file format. Please upload a .png, .jpg, or .jpeg file.');
            await askForLogo();
          }
          resolve();
        });
      });
    };

    await askForTokenDetails('name', '1. Enter Token Name:');
    await askForTokenDetails('symbol', '2. Enter Token Symbol:');
    await askForLogo();
    await askForTokenDetails('description', '4. Enter Token Description:');
    await askForTokenDetails('decimal', '5. Enter Token Decimal:');
    await askForTokenDetails('amount', '6. Enter Token Supply:');

    const confirmationMessage = `Please confirm the following details:\n\n`
      + `Token Name: ${tokenDetails.name}\n`
      + `Token Symbol: ${tokenDetails.symbol}\n`
      + `Token Logo: ${tokenDetails.logo}\n`
      + `Token Description: ${tokenDetails.description}\n`
      + `Token Decimal: ${tokenDetails.decimal}\n`
      + `Token Supply: ${tokenDetails.amount}\n\n`
      + `Type /confirm to proceed or /cancel to abort.`;

    bot.sendMessage(chatId, confirmationMessage);

    bot.once('text', async (msg) => {
      const confirmationCommand = msg.text.toLowerCase();

      if (confirmationCommand === '/confirm') {
        bot.sendMessage(chatId, 'Token deployment in progress...');
        await createToken(tokenDetails, user.solanaPublicKey, user.solanaPrivateKey, chatId);
        bot.sendMessage(chatId, 'Token deployment successful!');
      } else if (confirmationCommand === '/cancel') {
        bot.sendMessage(chatId, 'Token deployment canceled.');
      } else {
        bot.sendMessage(chatId, 'Invalid command. Token deployment canceled.');
      }
    });
  } else {
    bot.sendMessage(chatId, 'Please use /start to create a Solana wallet first.');
  }
});
