// addMetadataModule.js
const path = require("path");
const { metadata } = require('./metadata');

// Function to wait for user response to inline buttons
async function waitForInlineButtonResponse(chatId, bot) {
  return new Promise((resolve) => {
    bot.once("callback_query", (query) => {
      if (query.message.chat.id.toString() === chatId.toString()) {
        resolve(query.data);
      }
    });
  });
}

// Function to add metadata
const addMetadata = async (chatId, bot, metadataRes, metadataDetails, metadataFilePath) => {
  try {
    // Define metadata details using the metadata URL
    const metadataInfo = {
      name: metadataDetails.name,
      symbol: metadataDetails.symbol,
      uri: `https://gateway.pinata.cloud/ipfs/${metadataRes.data.IpfsHash}/${path.basename(metadataFilePath)}`,
    };

    // Send a confirmation message with "Confirm" and "Reject" buttons
    const confirmationMessage = await bot.sendMessage(
      chatId,
      `📖Metadata added successfully! ✅\n\n🟢Name: ${metadataInfo.name}\n🟢Symbol: ${metadataInfo.symbol}\n🔗URI: ${metadataInfo.uri}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Click to Confirm", callback_data: "confirm" }],
            [{ text: "Click to Reject", callback_data: "reject" }],
          ],
        },
      }
    );
    
    // Use the value of confirmationMessage somewhere in the code
    console.log('Confirmation Message ID:', confirmationMessage.message_id);

    // Use the waitForInlineButtonResponse function in your code
    const confirmationResponse = await waitForInlineButtonResponse(chatId, bot);

    // Delete the confirmation message
    bot.deleteMessage(chatId, confirmationMessage.message_id);

    if (confirmationResponse === "confirm") {
      // Call the metadata function with metadata details and the bot object
      await metadata(metadataInfo, chatId, bot);
    } else if (confirmationResponse === "reject") {
      // Handle the rejection logic (optional)
      console.log(`User ${chatId} rejected the metadata.`);
      bot.sendMessage(chatId, "You rejected the metadata.");
      // Add any additional rejection logic here
    }

  } catch (error) {
    console.error(error);
  }
};

module.exports = { addMetadata };
