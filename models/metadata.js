const mongoose = require("mongoose");

const fileMetadataSchema = new mongoose.Schema({
  name: String,
  symbol: String,
  description: String,
  image: String,
});

const FileMetadata = mongoose.model("FileMetadata", fileMetadataSchema);

module.exports = FileMetadata;
