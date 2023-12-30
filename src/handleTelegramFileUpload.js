// newmetadata.js
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const FileMetadata = require("../models/metadata");
const addMetadataModule = require('./addMetadataModule');

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

      // Save metadata to the database
      await saveMetadataToDatabase(metadataDetails);

      // Delete the "Processing metadata" message
      bot.deleteMessage(chatId, processingMessage.message_id);

      // Call the addMetadata function with metadataDetails and metadata URL
      addMetadataModule.addMetadata(chatId, bot, metadataRes, metadataDetails, metadataFilePath);
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
  try {
    // Ask the user for metadata details
    const nameMessage = await bot.sendMessage(chatId, "Enter Token Name:");
    const name = await waitForUserResponse(chatId, bot);

    // Delete the name message
    bot.deleteMessage(chatId, nameMessage.message_id);

    const symbolMessage = await bot.sendMessage(chatId, "Enter Token Symbol:");
    const symbol = await waitForUserResponse(chatId, bot);

    // Delete the symbol message
    bot.deleteMessage(chatId, symbolMessage.message_id);

    const descriptionMessage = await bot.sendMessage(chatId, "Enter Description:");
    const description = await waitForUserResponse(chatId, bot);

    // Delete the description message
    bot.deleteMessage(chatId, descriptionMessage.message_id);

    return { name, symbol, description };
  } catch (error) {
    console.error(error);
    return null;
  }
};

// Function to wait for user response
async function waitForUserResponse(chatId, bot) {
    return new Promise((resolve) => {
      bot.once("message", (msg) => {
        if (msg.chat.id.toString() === chatId.toString()) {
          resolve(msg.text);
        }
      });
    });
  }

// Export the handleTelegramFileUpload function
module.exports = { handleTelegramFileUpload };