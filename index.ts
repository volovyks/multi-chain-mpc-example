import * as nearAPI from "near-api-js";
import { Uint, Web3 } from "web3"
import { bytesToHex, ecsign, ecrecover } from '@ethereumjs/util';
import { FeeMarketEIP1559TxData, FeeMarketEIP1559Transaction } from '@ethereumjs/tx';
import { Chain, Common } from '@ethereumjs/common'
import { TextEncoder } from 'util';

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


    let web3 = new Web3(ETHEREUM_SEPOLIA_RPC_URL);
    let nonce = await web3.eth.getTransactionCount(ETHEREUM_SEPOLIA_SENDER_ADDRESS);

    await printBalances("before", web3);

    const common = new Common({ chain: Chain.Sepolia });
    let transactionData = {
        nonce: nonce,
        gasLimit: 21000,
        maxFeePerGas: 32725779198,
        maxPriorityFeePerGas: 1,
        to: ETHEREUM_SEPOLIA_RECIEVER_ADDRESS,
        value: 1,
        // value: 1 + Math.floor(Math.random() * 1000000000000000), // randomised value to buypass same payload issue
        chainId: ETHEREUM_SEPOLIA_CHAIN_ID,
    } as FeeMarketEIP1559TxData;
    console.log("Transaction data: ", transactionData);

    let transaction = FeeMarketEIP1559Transaction.fromTxData(transactionData, { common });
    let messageHash: Uint8Array = transaction.getHashedMessageToSign();

    let useMpc = true;
    let final_v: bigint, final_r: Uint8Array, final_s: Uint8Array;

    if (useMpc) {
        let account = await initNearAccount(NEAR_ACCOUNT_ID, NEAR_ACCOUNT_SK);
        let signatureResponse = await signPayloadWithMpc(account, MULTI_CHAIN_CONTRACT_ID, messageHash, DERIVATION_PATH);
        console.log("Signature response from MPC: ", signatureResponse);
        let { v, r, s } = getVrsFromMpcResponce(signatureResponse);
        final_r = r;
        final_s = s;
        final_v = v;
    } else {
        const { v, r, s } = ecsign(messageHash, Buffer.from(ETHEREUM_SEPOLIA_SENDER_PRIVATE_KEY.slice(2), 'hex'), ETHEREUM_SEPOLIA_CHAIN_ID);
        final_r = r;
        final_s = s;
        final_v = getYParityFromRecoveryId(v);
    }
    console.log(`v: ${final_v}, r: ${final_r}, s: ${final_s}`);

    let signedTransaction = transaction.addSignature(final_v, final_r, final_s);
    if (signedTransaction.getValidationErrors().length > 0) { throw new Error("Transaction validation errors"); }
    if (!signedTransaction.verifySignature()) { throw new Error("Signature is not valid"); }

    let recoveredSenderAddress = bytesToHex(signedTransaction.getSenderAddress().bytes);
    console.log("Recovered sender address: ", recoveredSenderAddress);
    // if (recoveredSenderAddress != ETHEREUM_SEPOLIA_SENDER_ADDRESS.toLowerCase()) { throw new Error("Recovered sender address is not valid"); }

    // const serializedTx = bytesToHex(signedTransaction.serialize());
    // const transactionResult = await web3.eth.sendSignedTransaction(serializedTx);
    // console.log("Ethereum Transaction hash: ", transactionResult);

    // await printBalances("after", web3);
}

function stringToUint8Array(inputString: string): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(inputString);
}

function getVrsFromMpcResponce(mpcSignatureResponce: [string, string]): { v: bigint, r: Uint8Array, s: Uint8Array } {
    const big_r = mpcSignatureResponce[0];
    const v = getYParityFromBigR(big_r);
    const r = getRfromBigR(big_r);
    const s = Buffer.from(mpcSignatureResponce[1], 'hex');
    return { v, r, s };
}

function getRfromBigR(big_r: string): Uint8Array {
    return Buffer.from(big_r.substring(2), 'hex');
}

function getYParityFromBigR(big_r: string): bigint {
    if (big_r.startsWith("02")) {
        return 0n;
    } else if (big_r.startsWith("03")) {
        return 1n;
    } else {
        throw new Error("Big R must start with '02' or '03'.");
    }
}

function getYParityFromRecoveryId(v: bigint): bigint {
    return 1n - (v % 2n);
}

async function printBalances(tag: String, web3: Web3) {
    console.log(`Reciever balance ${tag}:`, await web3.eth.getBalance(ETHEREUM_SEPOLIA_RECIEVER_ADDRESS));
    console.log(`Sender balance  ${tag}:`, await web3.eth.getBalance(ETHEREUM_SEPOLIA_SENDER_ADDRESS));
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

async function signPayloadWithMpc(account: nearAPI.Account, multichainContractId: string, payload: Uint8Array, derivationPath: string): Promise<[string, string]> {
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

    let result = await multichainContract.sign({
        args: {
            payload: Array.from(payload),
            path: derivationPath,
        },
        gas: "300000000000000"
    });

    return result as unknown as [string, string];
}

main();