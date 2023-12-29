const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const uploadFileToPinata = async (filePath, options) => {
  try {
    const originalFileName = path.basename(filePath);
    const data = new FormData();
    const fileStream = fs.createReadStream(filePath);
    const numberedFileName = `${Date.now()}_${originalFileName}`;
    
    data.append('file', fileStream, { filename: numberedFileName });
    data.append('pinataOptions', JSON.stringify(options));

    const res = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', data, {
      headers: {
        'Authorization': `Bearer ${process.env.PINATA_JWT}`,
        ...data.getHeaders(),
      },
    });

    console.log(res.data);
    console.log(`View the file here: https://gateway.pinata.cloud/ipfs/${res.data.IpfsHash}/${numberedFileName}`);
    
    return { res, numberedFileName };
  } catch (error) {
    console.error(error);
    return null;
  }
};

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

const pinFileToIPFS = async (filePath) => {
  try {
    const { res, numberedFileName } = await uploadFileToPinata(filePath, { cidVersion: 0, wrapWithDirectory: true });

    const metadata = {
      name: "GUDS Coin",
      symbol: "GUDS",
      description: "Just a test for solana",
      image: `https://gateway.pinata.cloud/ipfs/${res.data.IpfsHash}/${numberedFileName}`
    };

    const directoryPath = './src/Metadata';

    const metadataFilePath = saveMetadataToFile(metadata, numberedFileName, directoryPath);

    if (metadataFilePath) {
      const metadataFormData = new FormData();
      const metadataStream = fs.createReadStream(metadataFilePath);
      metadataFormData.append('file', metadataStream, { filename: path.basename(metadataFilePath) });
      metadataFormData.append('pinataOptions', '{"cidVersion": 0, "wrapWithDirectory": true}');
      
      const metadataRes = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', metadataFormData, {
        headers: {
          'Authorization': `Bearer ${process.env.PINATA_JWT}`,
          ...metadataFormData.getHeaders(),
        },
      });

      console.log(metadataRes.data);
      console.log(`Metadata uploaded to: https://gateway.pinata.cloud/ipfs/${metadataRes.data.IpfsHash}/${path.basename(metadataFilePath)}`);
    }
  } catch (error) {
    console.error(error);
  }
};

// Example usage
const filePath = './logo.jpg';
pinFileToIPFS(filePath);
