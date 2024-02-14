import * as nearAPI from "near-api-js";
import * as crypto from "crypto";
import { Web3 } from "web3"
import { ecsign } from 'ethereumjs-util';
import { Transaction, TxData, TxOptions } from "web3-eth-accounts";

const RPC_URL = "https://rpc.testnet.near.org";
const MULTI_CHAIN_CONTRACT_ID = "multichain-testnet-2.testnet"; // "multichain-dev0.testnet"
const NEAR_ACCOUNT_ID = "test-fastauth-user789.testnet";
const NEAR_ACCOUNT_SK = "ed25519:2FtrAXcQQP9TNL7fKQc8vjQcBLfwfjYu6U3mWMNYMypGk3K3ofQFVFqrPWQoNNKSCASmCYmT3yUnzC9M1cGCWA63";
const DERIVATION_PATH = "bnb";

const BNB_TESTNET_RPC_URL = "https://data-seed-prebsc-1-s1.binance.org:8545";
const BNB_RECIEVER_ADDRESS = "0xa3286628134bad128faeef82f44e99aa64085c94";
const BNB_SENDER_ADDRESS = "0x46Dd36F3235C748961427854948B32BD412AdD3c";
const BNB_SENDER_PRIVATE_KEY = "0x9ea65c28a56227218ae206bacfa424be4da742791d93cb396d0ff5da3cee3736";
const BNB_TESTNET_CHAIN_ID = 97n;

async function main() {
    let account = await initNearAccount(NEAR_ACCOUNT_ID, NEAR_ACCOUNT_SK);
    let bnbTransaction = await createBnbTransactionAndGetItsHash();

    let signature = await signPayloadWithMpc(account, MULTI_CHAIN_CONTRACT_ID, bnbTransaction, DERIVATION_PATH);
    console.log("Signature: ", signature);

    //////////////////////// Sign and sent to BNC //////////////////////////
    let web3 = new Web3(BNB_TESTNET_RPC_URL);
    let chainId = await web3.eth.getChainId() as unknown as number;
    console.log("Chain ID: ", chainId);
    let nonce = await web3.eth.getTransactionCount(BNB_SENDER_ADDRESS);
    console.log("Nonce: ", nonce);
    let gasPrice = await web3.eth.getGasPrice(); // Do we need this?
    console.log("Gas price: ", gasPrice);

    await printBalances("before", web3);

    let transactionOptions = {} as TxOptions;
    let transactionData = {
        nonce: nonce,
        gasPrice: web3.utils.toHex(web3.utils.toWei('10', 'gwei')), // adjust gas price as needed
        gas: web3.utils.toHex(21000), // you may need to adjust the gas limit
        to: BNB_RECIEVER_ADDRESS,
        value: web3.utils.toHex(web3.utils.toWei('1', 'kwei')),
        data: '0x', // optional data field
    } as TxData;
    let transaction = Transaction.fromTxData(transactionData);
    let messageHash = transaction.getMessageToSign(true);

    const { v, r, s } = ecsign(Buffer.from(messageHash), Buffer.from(BNB_SENDER_PRIVATE_KEY.slice(2), 'hex'));

    (transaction as any)._processSignature(BigInt(v), r, s); // Hack to call protected method

    let transactionHash = await web3.eth.sendSignedTransaction(transaction.serialize()); // TODO: check serialization
    console.log("BNC transaction hash: ", transactionHash);

    await printBalances("after", web3);
}

async function printBalances(tag: String, web3: Web3) {
    console.log(`Reciever balance ${tag}:`, await web3.eth.getBalance(BNB_RECIEVER_ADDRESS));
    console.log(`Sender balance  ${tag}:`, await web3.eth.getBalance(BNB_SENDER_ADDRESS));
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