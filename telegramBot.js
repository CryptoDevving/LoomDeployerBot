// telegramBot.js
require('dotenv').config();
const { createToken } = require('./createToken');
const { Telegraf } = require('telegraf');

const botToken = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Function to send a message to a specific chat
async function sendMessage(chatId, text) {
  const { default: fetch } = await import('node-fetch');
  const baseUrl = `https://api.telegram.org/bot${botToken.token}`;

  const url = `${baseUrl}/sendMessage`;
  const params = {
    chat_id: chatId,
    text,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  const result = await response.json();
  return result;
}

// Example: Handle incoming updates from Telegram (polling)
let offset = 0; // Initialize offset outside the function

async function pollTelegram() {
    const { default: fetch } = await import('node-fetch');
    const baseUrl = `https://api.telegram.org/bot${botToken.token}`;
    const url = `${baseUrl}/getUpdates?offset=${offset + 1}&timeout=30`;

    const response = await fetch(url);
    const result = await response.json();

    if (result.ok && result.result.length > 0) {
        offset = result.result[result.result.length - 1].update_id; // Update offset to the latest update_id

        result.result.forEach((update) => {
            const { message } = update;
            if (message && message.text) {
                handleIncomingMessage(message.chat.id, message.text);
            }
        });
    }

    // Repeat the long polling
    pollTelegram();
}

// Start long polling
pollTelegram();

// Example usage: Handle incoming messages
async function handleIncomingMessage(chatId, text) {
  // Parse the incoming message and extract relevant information
  const command = text.split(' ');

  // Check for the /start command
  if (command[0] === '/start') {
    // Send a welcome message and instructions
    const welcomeMessage = 'Welcome! Use /createToken to create and mint tokens on Solana.';
    const instructions = 'Format: /createToken TokenName Symbol MetadataUrl Amount Decimals';
    await sendMessage(chatId, `${welcomeMessage}\n${instructions}`);
  } else if (command[0] === '/createToken' && command.length === 6) {
    // Handle the /createToken command
    const [, tokenName, symbol, metadata, amount, decimals] = command;
    const form = {
      tokenName,
      symbol,
      metadata,
      amount,
      decimals,
    };

    // Call your createToken function
    await createToken(chatId, form);
  } else {
    // Handle other commands or provide instructions
    const message = 'Invalid command. Use /createToken TokenName Symbol MetadataUrl Amount Decimals';
    await sendMessage(chatId, message);
  }
}
