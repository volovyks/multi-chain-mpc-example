import * as nearAPI from "near-api-js";
import * as crypto from "crypto";
import { Web3 } from "web3"
import { ecsign, bytesToHex } from '@ethereumjs/util';
import { LegacyTxData, LegacyTransaction } from '@ethereumjs/tx';
import { Chain, Common, Hardfork } from '@ethereumjs/common'
import { RLP } from '@ethereumjs/rlp'

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
    let web3 = new Web3(ETHEREUM_SEPOLIA_RPC_URL);
    let chainId = await web3.eth.getChainId() as unknown as number;
    console.log("Chain ID: ", chainId);
    let nonce = await web3.eth.getTransactionCount(ETHEREUM_SEPOLIA_SENDER_ADDRESS);
    console.log("Nonce: ", nonce);
    let gasPrice = await web3.eth.getGasPrice(); // Do we need this?
    console.log("Gas price: ", gasPrice);

    await printBalances("before", web3);

    const common = new Common({ chain: Chain.Sepolia, hardfork: Hardfork.Istanbul })
    let transactionData = {
        nonce: nonce,
        gasLimit: 21000,
        // gasPrice,
        gasPrice: 123004900n, // TODO: dynamic gas price is changing the recovered address. Why?
        to: ETHEREUM_SEPOLIA_RECIEVER_ADDRESS,
        value: 1,
        chainId: null, // In legacy transaction, chainId is not included
    } as LegacyTxData;
    console.log("Transaction data: ", transactionData);

    let transaction = LegacyTransaction.fromTxData(transactionData, { common });
    // console.log("Transaction: ", transaction);

    // let messageHash: Uint8Array[] = transaction.getMessageToSign(); // TODO: which one do we need?
    let messageHash: Uint8Array = transaction.getHashedMessageToSign();
    console.log("Message hash: ", messageHash);
    const encodedMessageHash = RLP.encode(messageHash); // Looks like it's need to be done for Legacy transaction
    console.log("Encoded message hash: ", encodedMessageHash);
    
    const { v, r, s } = ecsign(encodedMessageHash, Buffer.from(ETHEREUM_SEPOLIA_SENDER_PRIVATE_KEY.slice(2), 'hex'));
    console.log(`v: ${v}, r: ${r}, s: ${s}`); // In legacy transaction, v is 27 or 28, but in EIP-155, v is chainId * 2 + 35 or chainId * 2 + 36
    
    let signedTransaction = transaction.addSignature(v, r, s);
    // console.log("Transaction with signature: ", signedTransaction);
    let signedMessageHash: Uint8Array = signedTransaction.getHashedMessageToSign();
    console.log("Signed message hash: ", signedMessageHash);
    let encodedSignedMessageHash = RLP.encode(signedMessageHash);
    console.log("Encoded signed message hash: ", encodedSignedMessageHash);

    let isSignatureValid = signedTransaction.verifySignature();
    console.log("Is signature valid: ", isSignatureValid);
    let recoveredSenderAddress = bytesToHex(signedTransaction.getSenderAddress().bytes);
    console.log("Recovered sender address: ", recoveredSenderAddress);
    let recoveredPublicKey = bytesToHex(signedTransaction.getSenderPublicKey());
    console.log("Recovered public key: ", recoveredPublicKey);
    let transactionValidationErrors = signedTransaction.getValidationErrors();
    console.log("Transaction validation errors: ", transactionValidationErrors);

    // TODO: do we need to do this?
    const serializedTx = bytesToHex(signedTransaction.serialize());
    const transactionHash = await web3.eth.sendSignedTransaction(`${serializedTx}`);
    console.log("Ethereum Transaction hash: ", transactionHash);

    await printBalances("after", web3);
}

async function printBalances(tag: String, web3: Web3) {
    console.log(`Reciever balance ${tag}:`, await web3.eth.getBalance(ETHEREUM_SEPOLIA_RECIEVER_ADDRESS));
    console.log(`Sender balance  ${tag}:`, await web3.eth.getBalance(ETHEREUM_SEPOLIA_SENDER_ADDRESS));
}

async function createBnbTransactionAndGetItsHash(): Promise<Uint8Array> {
    // TODO: Implement BNB transaction creation
    const randomBuffer = crypto.randomBytes(32);
    return Uint8Array.from(randomBuffer);
}

async function initNearAccount(accountId: string, secretKey: string): Promise<nearAPI.Account> {
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

async function signPayloadWithMpc(account: nearAPI.Account, multichainContractId: string, payload: Uint8Array, derivationPath: string) {
    type SignFunction = (params: {
        args: { payload: Array<number>, path: string },
        gas: string
    }) => string;

    type MultichainContract = nearAPI.Contract & {
        sign: SignFunction;
    };

    const multichainContract = new nearAPI.Contract(
        account,
        multichainContractId,
        {
            changeMethods: ["sign"],
            viewMethods: [],
            abi: undefined,
            useLocalViewExecution: false,
        }
    ) as MultichainContract;;

    return await multichainContract.sign({
        args: {
            payload: Array.from(payload),
            path: derivationPath,
        },
        gas: "300000000000000"
    });
}

main();