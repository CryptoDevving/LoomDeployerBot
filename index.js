require("dotenv").config();
const DeployedToken = require('./models/deployToken');
const web3 = require('@solana/web3.js');
const TelegramBot = require('node-telegram-bot-api');  
const SPLToken = require('@solana/spl-token');
const SPLTokenMetadata = require('@solana/spl-token-metadata');
const { Connection, PublicKey, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const mongoose = require('mongoose');

// Set up MongoDB connection
mongoose.connect(process.env.MONGODB_CONNECTION, { useNewUrlParser: true, useUnifiedTopology: true });

const User = mongoose.model('User', {
  telegramId: Number,
  solanaPublicKey: String,
  solanaPrivateKey: Array,
});

// Set up Solana connection
const connection = new web3.Connection('https://nd-519-484-423.p2pify.com/8a1f983c912a2b45e455ed96c59cfee2', 'confirmed');

// Set up Telegram bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Command to handle /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
  
    // Check if the user already exists in the database
    let user = await User.findOne({ telegramId: userId });
  
    if (!user) {
      // Create a Solana wallet for the user
      const keypair = Keypair.generate();
      const publicKey = keypair.publicKey.toString();
      const privateKey = keypair.secretKey.toString();
  
      // Store the user in the database
      user = new User({
        telegramId: userId,
        solanaPublicKey: publicKey,
        solanaPrivateKey: privateKey,
      });
      await user.save();
  
      bot.sendMessage(chatId, `Welcome! Your Solana wallet has been created.\nYour public key: ${publicKey}`);
      bot.sendMessage(chatId, `Keep your private key secure. If lost, it cannot be recovered.\nYour encrypted private key: ${privateKey}`);
    } else {
      bot.sendMessage(chatId, `Welcome back! Your Solana wallet already exists.\nYour public key: ${user.solanaPublicKey}`);
    }
  });
  
// Function to create a new token, mint tokens, set metadata, set authority, and store in the database
async function createToken(tokenDetails, userPublicKey, chatId) {
    try {
        const tokenProgramId = SPLToken.TOKEN_PROGRAM_ID;

        if (!tokenProgramId) {
            throw new Error('TOKEN_PROGRAM_ID is not defined');
        }

        // Wallet keypair for token deployment
        const payerKeypair = Keypair.generate();
        const mintAuthority = Keypair.generate();
        const freezeAuthority = Keypair.generate();

        // Create the token
        const mint = await SPLToken.createMint(
            connection,
            payerKeypair,
            mintAuthority.publicKey,
            freezeAuthority.publicKey,
            tokenDetails.decimal
        );

        console.log('Mint Address:', mint.toBase58());

        // Create the token account for the user
        const userTokenAccount = await SPLToken.Token.getOrCreateAssociatedTokenAccountInfo(
            connection,
            userPublicKey,
            mint.publicKey
        );

        console.log('Token Account Address:', userTokenAccount.address.toBase58());

        // Mint tokens to the user's account
        await SPLToken.Token.mintTo(
            connection,
            mint.publicKey,
            userTokenAccount.address,
            mintAuthority,
            [],
            tokenDetails.amount * Math.pow(10, tokenDetails.decimal)
        );

        bot.sendMessage(chatId, 'Token deployment and minting successful!');
    } catch (error) {
        console.error('Token deployment error:', error);
        bot.sendMessage(chatId, 'Token deployment and minting failed. Please try again.');
    }
}


// Command to handle /deploy
bot.onText(/\/deploy/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
  
    // Retrieve user from the database
    const user = await User.findOne({ telegramId: userId });
  
    if (user) {
      // Object to store token details
      const tokenDetails = {};
  
      // Function to ask for token details
      const askForTokenDetails = async (fieldName, prompt) => {
        bot.sendMessage(chatId, prompt);
        return new Promise((resolve) => {
          bot.once('text', async (msg) => {
            tokenDetails[fieldName] = msg.text;
            resolve();
          });
        });
      };
  
      // Function to handle photo messages
      const askForLogo = async () => {
        return new Promise(async (resolve) => {
          bot.sendMessage(chatId, '3. Upload Token Logo (Accepted formats: .png, .jpg, .jpeg):');
  
          bot.once('photo', async (msg) => {
            const fileId = msg.photo[msg.photo.length - 1].file_id;
  
            // Get file details
            const fileDetails = await bot.getFile(fileId);
  
            // Check file format
            const fileName = fileDetails.file_path;
            if (fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
              tokenDetails['logo'] = fileName;
              bot.sendMessage(chatId, 'Logo uploaded successfully.');
            } else {
              bot.sendMessage(chatId, 'Invalid file format. Please upload a .png, .jpg, or .jpeg file.');
              await askForLogo(); // Ask again for logo
            }
            resolve();
          });
        });
      };
  
      // Ask the user for token details sequentially
        await askForTokenDetails('name', '1. Enter Token Name:');
        await askForTokenDetails('symbol', '2. Enter Token Symbol:');
        await askForLogo(); // Ask for Token Logo
        await askForTokenDetails('description', '4. Enter Token Description:');
        await askForTokenDetails('decimal', '5. Enter Token Decimal:');

        // Prompt the user for the token supply
        await askForTokenDetails('amount', '6. Enter Token Supply:');

        // Display collected token details for confirmation
        const confirmationMessage = `Please confirm the following details:\n\n`
        + `Token Name: ${tokenDetails.name}\n`
        + `Token Symbol: ${tokenDetails.symbol}\n`
        + `Token Logo: ${tokenDetails.logo}\n`
        + `Token Description: ${tokenDetails.description}\n`
        + `Token Decimal: ${tokenDetails.decimal}\n`
        + `Token Supply: ${tokenDetails.amount}\n\n`
        + `Type /confirm to proceed or /cancel to abort.`;

        bot.sendMessage(chatId, confirmationMessage);
  
      // Wait for user confirmation
    bot.once('text', async (msg) => {
        const confirmationCommand = msg.text.toLowerCase();

        if (confirmationCommand === '/confirm') {
            // Call the createToken function with the collected token details
            await createToken(tokenDetails, user.solanaPublicKey, chatId);
          // ...
  
          bot.sendMessage(chatId, 'Token deployment in progress...');
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