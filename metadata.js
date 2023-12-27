const { config } = require('dotenv');
config();

const {
    Collection,
    CreateMetadataAccountV3InstructionAccounts,
    CreateMetadataAccountV3InstructionDataArgs,
    Creator,
    MPL_TOKEN_METADATA_PROGRAM_ID,
    UpdateMetadataAccountV2InstructionAccounts,
    UpdateMetadataAccountV2InstructionData,
    Uses,
    createMetadataAccountV3,
    updateMetadataAccountV2,
    findMetadataPda,
  } = require("@metaplex-foundation/mpl-token-metadata");
  const web3 = require("@solana/web3.js");
  const {
    PublicKey,
    createSignerFromKeypair,
    none,
    signerIdentity,
    some,
  } = require("@metaplex-foundation/umi");
  const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
  const {
    fromWeb3JsKeypair,
    fromWeb3JsPublicKey,
  } = require('@metaplex-foundation/umi-web3js-adapters');
  
  function loadWalletKey(privateKeyBytes) {
    return web3.Keypair.fromSecretKey(new Uint8Array(privateKeyBytes));
  }
  
  const INITIALIZE = true;
  
  async function metadata() {
    console.log("Let's name some tokens in 2024!");
  
    // Replace with your mint public key and metadata details
    const mintPublicKey = "J1pxwYKLEja6JiEPZSdQRGibfpcBQd6MCZMyWZ9SSzNx";
    const metadataDetails = {
      name: "GUDS",
      symbol: "GUDS",
      uri: "https://wos4qmv7zzcu343kkvwdugn6l7fqhb2vcjvibhhb4snfzqdpjq2a.arweave.net/s6XIMr_ORU3zalVsOhm-X8sDh1USaoCc4eSaXMBvTDQ?ext=png",
    };
  
    const mint = new web3.PublicKey(mintPublicKey);
    const privateKeyBytes = process.env.PRIVATE_KEY.split(',').map(Number);
  
    const umi = createUmi("https://api.devnet.solana.com");
    const signer = createSignerFromKeypair(
      umi,
      fromWeb3JsKeypair(loadWalletKey(privateKeyBytes))
    );
    umi.use(signerIdentity(signer, true));
  
    const onChainData = {
      ...metadataDetails,
      sellerFeeBasisPoints: 0,
      creators: none(),
      collection: none(),
      uses: none(),
    };
  
    if (INITIALIZE) {
      const accounts = {
        mint: fromWeb3JsPublicKey(mint),
        mintAuthority: signer,
      };
      const data = {
        isMutable: true,
        collectionDetails: null,
        data: onChainData,
      };
      const txid = await createMetadataAccountV3(umi, { ...accounts, ...data }).sendAndConfirm(umi);
      console.log(txid);
    } else {
      const data = {
        data: some(onChainData),
        discriminator: 0,
        isMutable: some(true),
        newUpdateAuthority: none(),
        primarySaleHappened: none(),
      };
      const accounts = {
        metadata: findMetadataPda(umi, { mint: fromWeb3JsPublicKey(mint) }),
        updateAuthority: signer,
      };
      const txid = await updateMetadataAccountV2(umi, { ...accounts, ...data }).sendAndConfirm(umi);
      console.log(txid);
    }
  }
  
  metadata();
  