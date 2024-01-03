// newmetadata.js
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const bigInt = require('big-integer');
const FileMetadata = require("../models/metadata");
const addMetadataModule = require('./addMetadataModule');
const {createMintAccountAndMintTokens} = require('../ttDeploy');
const pathToFolders = {
  loomDeployedTokenLogo: "./src/loomDeployedTokenLogo",
};

// Function to handle the file upload through Telegram
const handleTelegramFileUpload = async (chatId, bot) => {
  try {
    // Prompt the user to upload a document
    const uploadMessage = await bot.sendMessage(
      chatId,
      "Please upload your image file (Do not Compress)\n\nSupported formats: jpg, jpeg, png\nDo not upload the file as a picture"
    );

    // Wait for the user to upload the file
    bot.once("document", async (msg) => {
      try {
        // Delete the upload message
        bot.deleteMessage(chatId, uploadMessage.message_id);
        const fileId = msg.document.file_id;
        const fileUrl = await bot.getFileLink(fileId);
        const response = await axios.get(fileUrl, { responseType: "stream" });
        const filePath = path.join(`${msg.document.file_name}`);
        const fileStream = fs.createWriteStream(filePath);
        response.data.pipe(fileStream);
        fileStream.on("finish", async () => {
          const destinationFileName = `${Date.now()}_${msg.document.file_name}`;
          // Upload the file to Pinata and pin to IPFS
          await pinFileToIPFS(filePath, chatId, bot, destinationFileName);
          // Move the uploaded file to the specified folder
          const destinationPath = path.join(pathToFolders.loomDeployedTokenLogo, destinationFileName);
          fs.renameSync(filePath, destinationPath);
        });
      } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, "Error processing the uploaded file.");
      }
    });
  } catch (error) {
    console.error(error);
  }
};

// Function to pin file to IPFS after uploading
const pinFileToIPFS = async (filePath, chatId, bot, destinationFileName) => {
  try {
    // Prompt the user for metadata details on Telegram
    const metadataDetails = await promptForMetadata(chatId, bot);
    // Continue only if metadata is received
    if (!metadataDetails || !metadataDetails.name || !metadataDetails.symbol || !metadataDetails.description) {
      bot.sendMessage(chatId, "Invalid metadata. Please try again.");
      return;
    }

    // Notify the user that metadata is processing
    const processingMessage = await bot.sendMessage(chatId, "Processing metadata. Please wait...");

    const { res } = await uploadFileToPinata(filePath, destinationFileName, {
      cidVersion: 0,
      wrapWithDirectory: true,
    });

    metadataDetails.image = `https://gateway.pinata.cloud/ipfs/${res.data.IpfsHash}/${destinationFileName}`;

    const directoryPath = "./src/Metadata";

    const metadataFilePath = saveMetadataToFile(
      metadataDetails,
      destinationFileName,
      directoryPath
    );

    if (metadataFilePath) {
      const metadataFormData = new FormData();
      const metadataStream = fs.createReadStream(metadataFilePath);
      metadataFormData.append("file", metadataStream, {
        filename: path.basename(metadataFilePath),
      });
      metadataFormData.append(
        "pinataOptions",
        '{"cidVersion": 0, "wrapWithDirectory": true}'
      );

      const metadataRes = await axios.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        metadataFormData,
        {
          headers: {
            Authorization: `Bearer ${process.env.PINATA_JWT}`,
            ...metadataFormData.getHeaders(),
          },
        }
      );

      console.log(
        `User ${chatId} Successfully Uploaded a new file!!! ✅`
      );
         // Call createMintAccountAndMintTokens function with tokenSupply and decimal
      await createMintAccountAndMintTokens( chatId, metadataDetails.decimal, metadataDetails.tokenSupply, bot );
      // Save metadata to the database
      await saveMetadataToDatabase(metadataDetails);

      // Delete the "Processing metadata" message
      bot.deleteMessage(chatId, processingMessage.message_id);
      // Call the addMetadata function with metadataDetails and metadata URL
     await addMetadataModule.addMetadata(chatId, bot, metadataRes, metadataDetails, metadataFilePath);
    
  }
} catch (error) {
  console.error(error);
}
};

// Function to upload a file to Pinata
const uploadFileToPinata = async (filePath, destinationFileName, options) => {
  try {

    // const originalFileName = path.basename(filePath);
    const data = new FormData();
    const fileStream = fs.createReadStream(filePath);
    const numberedFileName = destinationFileName;

    data.append("file", fileStream, { filename: numberedFileName });
    data.append("pinataOptions", JSON.stringify(options));

    const res = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      data,
      {
        headers: {
          Authorization: `Bearer ${process.env.PINATA_JWT}`,
          ...data.getHeaders(),
        },
      }
    );

    return { res, numberedFileName };
  } catch (error) {
    console.error(error);
    return null;
  }
};

// Function to save metadata to a file
const saveMetadataToFile = (metadataDetails, destinationFileName, directoryPath) => {
  try {
    const metadataFileName = `${path.parse(destinationFileName).name}.json`;
    const metadataFilePath = path.join(directoryPath, metadataFileName);
    fs.writeFileSync(metadataFilePath, JSON.stringify(metadataDetails, null, 2));
    return metadataFilePath;
  } catch (error) {
    console.error(error);
    return null;
  }
};

// Function to save metadata to the database
const saveMetadataToDatabase = async (metadataDetails) => {
  try {
    // Create a new FileMetadata instance and save it to the database
    const fileMetadata = new FileMetadata(metadataDetails);
    await fileMetadata.save();
  } catch (error) {
    console.error(error);
  }
};

// Function to prompt user for metadata details using Telegram bot
const promptForMetadata = async (chatId, bot) => {
  let previewMessage;

  try {
    // Ask the user for metadata details
    const nameMessage = await bot.sendMessage(chatId, "Enter Token Name:");
    const name = await waitForTextInput(chatId, bot);
    bot.deleteMessage(chatId, nameMessage.message_id);

    const symbolMessage = await bot.sendMessage(chatId, "Enter Token Symbol:");
    const symbol = await waitForTextInput(chatId, bot);
    bot.deleteMessage(chatId, symbolMessage.message_id);

    const descriptionMessage = await bot.sendMessage(chatId, "Enter Description:");
    const description = await waitForTextInput(chatId, bot);
    bot.deleteMessage(chatId, descriptionMessage.message_id);

    const decimalMessage = await bot.sendMessage(chatId, "Please enter the decimal for your token (0-10):");
    const decimalResponse = await waitForTextInput(chatId, bot);
    const decimal = parseInt(decimalResponse);

     // Check if the decimal value is within the valid range (0-10)
     if (isNaN(decimal) || decimal < 0 || decimal > 10) {
      console.error('Invalid decimal value. Please enter a valid integer between 0 and 10.');
      bot.sendMessage(chatId, 'Invalid decimal value. Please enter a valid integer between 0 and 10.');
      return;
    }

    bot.deleteMessage(chatId, decimalMessage.message_id);
    
    const tokenSupplyMessage = await bot.sendMessage(chatId, "Please enter the token supply\n⚠ Do not enter more than 1.8 Billion (1800000000)\nIf your decimal is 10");
    const supplyResponse = await waitForTextInput(chatId, bot);
    const rawTokenSupply = parseInt(supplyResponse);

    if (isNaN(rawTokenSupply) || rawTokenSupply < 0 || rawTokenSupply > 1800000000) {
      console.error('Invalid token supply. Please enter a valid integer between 0 and 1800000000');
      bot.sendMessage(chatId, 'Invalid token supply. Please enter a valid integer between 0 and 1800000000');
      return;
    }

    // Perform the multiplication and convert the result to bigInt
    const tokenSupply = bigInt(rawTokenSupply).multiply(bigInt(10).pow(decimal));
    // console.log('Token Supply Received:', tokenSupply.toString());
    bot.deleteMessage(chatId, tokenSupplyMessage.message_id);

    // Show a preview of metadata details
    previewMessage = await bot.sendMessage(
      chatId,
      `📖Preview\n\n🟢Token Name: ${name}\n🟢Symbol: ${symbol}\n📝Description: ${description}\n🟢Token Supply: ${tokenSupply}\n🟢Decimals: ${decimal}`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Confirm", callback_data: "confirm" },
              { text: "Edit", callback_data: "edit" },
            ],
          ],
        },
      }
    );

    // Log the metadata details
    console.log("Preview message sent: ");
    console.log(`Token Name: ${name}`);
    console.log(`Token Symbol: ${symbol}`);
    console.log(`Description: ${description}`);
    console.log(`Token Supply: ${tokenSupply}`);
    console.log(`Decimals: ${decimal}`);

    // Wait for the user's response on the preview
    const previewResponse = await waitForInlineButtonResponse(chatId, bot);

    if (previewResponse === "confirm") {
      return { name, symbol, description, tokenSupply, decimal };
    } else if (previewResponse === "edit") {
      // If the user chooses to edit, recursively call the promptForMetadata function
      return promptForMetadata(name, symbol, description, tokenSupply, decimal);
    }
  } catch (error) {
    console.error(error);
    return null;
  } finally {
    // Delete the preview message after processing user's response
    if (previewMessage) {
      bot.deleteMessage(chatId, previewMessage.message_id);
    }
  }
};

// Function to wait for user response to text input
async function waitForTextInput(chatId, bot) {
  return new Promise((resolve) => {
    bot.once("message", (msg) => {
      if (msg.chat.id.toString() === chatId.toString()) {
        resolve(msg.text);
      }
    });
  });
}


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


// Export the handleTelegramFileUpload function
module.exports = { handleTelegramFileUpload };