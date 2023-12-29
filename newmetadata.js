// Import necessary modules and dependencies
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Function to upload a file to Pinata
const uploadFileToPinata = async (filePath, options) => {
  try {
    const originalFileName = path.basename(filePath);
    const data = new FormData();
    const fileStream = fs.createReadStream(filePath);
    const numberedFileName = `${Date.now()}_${originalFileName}`;

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

    console.log(res.data);
    console.log(
      `View the file here: https://gateway.pinata.cloud/ipfs/${res.data.IpfsHash}/${numberedFileName}`
    );

    return { res, numberedFileName };
  } catch (error) {
    console.error(error);
    return null;
  }
};

// Function to save metadata to a file
const saveMetadataToFile = (metadata, numberedFileName, directoryPath) => {
  try {
    const metadataFileName = `${path.parse(numberedFileName).name}.json`;
    const metadataFilePath = path.join(directoryPath, metadataFileName);
    fs.writeFileSync(metadataFilePath, JSON.stringify(metadata, null, 2));
    return metadataFilePath;
  } catch (error) {
    console.error(error);
    return null;
  }
};

// Function to pin file to IPFS after uploading
const pinFileToIPFS = async (filePath, chatId, bot) => {
  try {
    const { res, numberedFileName } = await uploadFileToPinata(filePath, {
      cidVersion: 0,
      wrapWithDirectory: true,
    });

    const metadata = {
      name: "GUDS Coin",
      symbol: "GUDS",
      description: "Just a test for solana",
      image: `https://gateway.pinata.cloud/ipfs/${res.data.IpfsHash}/${numberedFileName}`,
    };

    const directoryPath = "./src/Metadata";

    const metadataFilePath = saveMetadataToFile(
      metadata,
      numberedFileName,
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

      console.log(metadataRes.data);
      console.log(
        `Metadata uploaded to: https://gateway.pinata.cloud/ipfs/${
          metadataRes.data.IpfsHash
        }/${path.basename(metadataFilePath)}`
      );
    }
  } catch (error) {
    console.error(error);
  }
};

// Function to handle the file upload through Telegram
const handleTelegramFileUpload = async (chatId, bot) => {
  try {
    // Prompt the user to upload a document
    bot.sendMessage(
      chatId,
      "Please upload your image file(Do not Compress)\n\nSupported formats: jpg, jpeg, png\n\nDo not upload the file as a picture"
    );

    // Wait for the user to upload the file
    bot.once("document", async (msg) => {
      try {
        // Get the file ID
        const fileId = msg.document.file_id;

        // Download the file using the file ID
        const fileUrl = await bot.getFileLink(fileId);
        const response = await axios.get(fileUrl, { responseType: "stream" });

        // Define the file path to save the downloaded file
        const filePath = path.join(`${msg.document.file_name}`);

        // Create a writable stream and pipe the file data
        const fileStream = fs.createWriteStream(filePath);
        response.data.pipe(fileStream);

        // When the file writing is complete
        fileStream.on("finish", async () => {
          // Upload the file to Pinata and pin to IPFS
          await pinFileToIPFS(filePath, chatId, bot);
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

// Export the handleTelegramFileUpload function
module.exports = { handleTelegramFileUpload };
