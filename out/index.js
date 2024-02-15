"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const nearAPI = __importStar(require("near-api-js"));
const crypto = __importStar(require("crypto"));
const web3_1 = require("web3");
const util_1 = require("@ethereumjs/util");
const tx_1 = require("@ethereumjs/tx");
const common_1 = require("@ethereumjs/common");
const RPC_URL = "https://rpc.testnet.near.org";
const MULTI_CHAIN_CONTRACT_ID = "multichain-testnet-2.testnet"; // "multichain-dev0.testnet"
const NEAR_ACCOUNT_ID = "test-fastauth-user789.testnet";
const NEAR_ACCOUNT_SK = "ed25519:2FtrAXcQQP9TNL7fKQc8vjQcBLfwfjYu6U3mWMNYMypGk3K3ofQFVFqrPWQoNNKSCASmCYmT3yUnzC9M1cGCWA63";
const DERIVATION_PATH = "sepolia";
const ETHEREUM_SEPOLIA_RPC_URL = "https://rpc2.sepolia.org";
const ETHEREUM_SEPOLIA_RECIEVER_ADDRESS = "0xa3286628134bad128faeef82f44e99aa64085c94";
const ETHEREUM_SEPOLIA_SENDER_ADDRESS = "0x46Dd36F3235C748961427854948B32BD412AdD3c";
const ETHEREUM_SEPOLIA_SENDER_PRIVATE_KEY = "0x9ea65c28a56227218ae206bacfa424be4da742791d93cb396d0ff5da3cee3736";
const ETHEREUM_SEPOLIA_CHAIN_ID = 11155111n;
async function main() {
    // let account = await initNearAccount(NEAR_ACCOUNT_ID, NEAR_ACCOUNT_SK);
    // let bnbTransaction = await createBnbTransactionAndGetItsHash();
    // let signature = await signPayloadWithMpc(account, MULTI_CHAIN_CONTRACT_ID, bnbTransaction, DERIVATION_PATH);
    // console.log("Signature: ", signature);
    //////////////////////// Sign and sent to BNC //////////////////////////
    let web3 = new web3_1.Web3(ETHEREUM_SEPOLIA_RPC_URL);
    let nonce = await web3.eth.getTransactionCount(ETHEREUM_SEPOLIA_SENDER_ADDRESS);
    await printBalances("before", web3);
    const common = new common_1.Common({ chain: common_1.Chain.Sepolia });
    let transactionData = {
        nonce: nonce,
        gasLimit: 21000,
        to: ETHEREUM_SEPOLIA_RECIEVER_ADDRESS,
        value: 1,
        chainId: ETHEREUM_SEPOLIA_CHAIN_ID,
    };
    console.log("Transaction data: ", transactionData);
    let transaction = tx_1.FeeMarketEIP1559Transaction.fromTxData(transactionData, { common });
    let messageHash = transaction.getHashedMessageToSign();
    const { v, r, s } = (0, util_1.ecsign)(messageHash, Buffer.from(ETHEREUM_SEPOLIA_SENDER_PRIVATE_KEY.slice(2), 'hex'), ETHEREUM_SEPOLIA_CHAIN_ID);
    console.log("Signature: ", { v, r, s });
    let signedTransaction = transaction.addSignature(getYParityFromRecoveryId(v), r, s);
    if (signedTransaction.getValidationErrors().length > 0) {
        throw new Error("Transaction validation errors");
    }
    if (!signedTransaction.verifySignature()) {
        throw new Error("Signature is not valid");
    }
    if ((0, util_1.bytesToHex)(signedTransaction.getSenderAddress().bytes) != ETHEREUM_SEPOLIA_SENDER_ADDRESS.toLowerCase()) {
        throw new Error("Recovered sender address is not valid");
    }
    const serializedTx = (0, util_1.bytesToHex)(signedTransaction.serialize());
    const transactionHash = await web3.eth.sendSignedTransaction(serializedTx);
    console.log("Ethereum Transaction hash: ", transactionHash);
    await printBalances("after", web3);
}
function getYParityFromRecoveryId(v) {
    return 1n - (v % 2n);
}
async function printBalances(tag, web3) {
    console.log(`Reciever balance ${tag}:`, await web3.eth.getBalance(ETHEREUM_SEPOLIA_RECIEVER_ADDRESS));
    console.log(`Sender balance  ${tag}:`, await web3.eth.getBalance(ETHEREUM_SEPOLIA_SENDER_ADDRESS));
}
async function createBnbTransactionAndGetItsHash() {
    // TODO: Implement BNB transaction creation
    const randomBuffer = crypto.randomBytes(32);
    return Uint8Array.from(randomBuffer);
}
async function initNearAccount(accountId, secretKey) {
    const myKeyStore = new nearAPI.keyStores.InMemoryKeyStore();
    await myKeyStore.setKey("testnet", accountId, nearAPI.KeyPair.fromString(secretKey));
    const connectionConfig = {
        networkId: "testnet",
        keyStore: myKeyStore,
        nodeUrl: RPC_URL,
    };
    const nearConnection = await nearAPI.connect(connectionConfig);
    return await nearConnection.account(accountId);
}
async function signPayloadWithMpc(account, multichainContractId, payload, derivationPath) {
    const multichainContract = new nearAPI.Contract(account, multichainContractId, {
        changeMethods: ["sign"],
        viewMethods: [],
        abi: undefined,
        useLocalViewExecution: false,
    });
    ;
    return await multichainContract.sign({
        args: {
            payload: Array.from(payload),
            path: derivationPath,
        },
        gas: "300000000000000"
    });
}
main();
