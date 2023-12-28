const { config } = require("dotenv");
config();

const {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
const {
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getMinimumBalanceForRentExemptMint,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  createMintToInstruction,
} = require("@solana/spl-token");

const TelegramBot = require("node-telegram-bot-api");

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const connection = new Connection("https://api.devnet.solana.com");

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const walletKeyPair = Keypair.generate();
  const privateKey = walletKeyPair.secretKey.toString();
  const publicKey = walletKeyPair.publicKey.toBase58();

  bot.sendMessage(chatId, `Your Private Key: ${privateKey}`);
  bot.sendMessage(chatId, `Your Public Key: ${publicKey}`);
});

bot.onText(/\/deploy/, async (msg) => {
  const chatId = msg.chat.id;

  // Ask the user for decimal
  bot.sendMessage(chatId, "Please enter the decimal for your token:");

  bot.once("text", async (msgDecimal) => {
    const decimal = parseInt(msgDecimal.text);

    // Ask the user for token supply
    bot.sendMessage(chatId, "Please enter the token supply:");

    bot.once("text", async (msgSupply) => {
      const rawTokenSupply = parseInt(msgSupply.text);
      const tokenSupply = rawTokenSupply * Math.pow(10, decimal);

      const privateKeyBytes = process.env.PRIVATE_KEY.split(",").map(Number);
      const walletKeyPair = Keypair.fromSecretKey(Uint8Array.from(privateKeyBytes));

      try {
        await createMintAccountAndMintTokens(walletKeyPair, chatId, decimal, tokenSupply);
      } catch (error) {
        console.error("Error creating mint and token account and minting tokens:", error);
        bot.sendMessage(chatId, "Error creating mint and token account and minting tokens");
      }
    });
  });
});

async function createMintAccountAndMintTokens(walletKeyPair, chatId, decimal, tokenSupply) {
  const mint = Keypair.generate();
  const lamports = await getMinimumBalanceForRentExemptMint(connection);

  const associatedTokenAddress = await getAssociatedTokenAddress(
    mint.publicKey,
    walletKeyPair.publicKey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const transaction = new Transaction();
  transaction.add(
    SystemProgram.createAccount({
      fromPubkey: walletKeyPair.publicKey,
      newAccountPubkey: mint.publicKey,
      space: MINT_SIZE,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMintInstruction(
      mint.publicKey,
      decimal,
      walletKeyPair.publicKey,
      walletKeyPair.publicKey,
      TOKEN_PROGRAM_ID
    ),
    createAssociatedTokenAccountInstruction(
      walletKeyPair.publicKey,
      associatedTokenAddress,
      walletKeyPair.publicKey,
      mint.publicKey,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    ),
    createMintToInstruction(
      mint.publicKey,
      associatedTokenAddress,
      walletKeyPair.publicKey,
      tokenSupply
    )
  );

  const signature = await sendAndConfirmTransaction(connection, transaction, [walletKeyPair, mint], {
    commitment: "singleGossip",
    preflightCommitment: "singleGossip",
  });

  bot.sendMessage(chatId, `Transaction Signature: ${signature}`);
  bot.sendMessage(chatId, `Mint Public Key: ${mint.publicKey.toBase58()}`);
  bot.sendMessage(chatId, `Token Account Address: ${associatedTokenAddress.toBase58()}`);
}
