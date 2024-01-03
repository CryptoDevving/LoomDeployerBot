const decimalMessage = await bot.sendMessage(
    chatId,
    "Please enter the decimal for your token (0-10):"
  );
  bot.once("text", async (msgDecimal) => {
    const decimal = parseInt(msgDecimal.text);

    // Check if the decimal value is within the valid range (0-10)
    if (isNaN(decimal) || decimal < 0 || decimal > 10) {
      console.error('Invalid decimal value. Please enter a valid integer between 0 and 10.');
      bot.sendMessage(chatId, 'Invalid decimal value. Please enter a valid integer between 0 and 10.');
      return;
    }

    // Delete the previous message
    bot.deleteMessage(chatId, decimalMessage.message_id);
    const supplyMessage = await bot.sendMessage(
      chatId,
      "Please enter the token supply\n⚠ Do not enter more than 1.8 Billion (1800000000)\nIf your decimal is 10"
    );
    bot.once("text", async (msgSupply) => {
      const rawTokenSupply = parseInt(msgSupply.text);

      if (isNaN(rawTokenSupply) || rawTokenSupply < 0 || rawTokenSupply > 18000000000000000000n) {
        console.error('Invalid token supply. Please enter a valid integer between 0 and 1800000000');
        bot.sendMessage(chatId, 'Invalid token supply. Please enter a valid integer between 0 and 1800000000');
        return;
      }

      // Perform the multiplication and convert the result to bigInt
      const tokenSupply = bigInt(rawTokenSupply).multiply(bigInt(10).pow(decimal));
      console.log('Token Supply:', tokenSupply.toString());