import * as nearAPI from "near-api-js";
import * as crypto from "crypto";

const RPC_URL = "https://rpc.testnet.near.org";
const MULTI_CHAIN_CONTRACT_ID = "multichain-dev0.testnet";
const NEAR_ACCOUNT_ID = "test-fastauth-user789.testnet";
const NEAR_ACCOUNT_SK = "ed25519:2FtrAXcQQP9TNL7fKQc8vjQcBLfwfjYu6U3mWMNYMypGk3K3ofQFVFqrPWQoNNKSCASmCYmT3yUnzC9M1cGCWA63";
const DERIVATION_PATH = "bnb";

async function main() {
    let account = await initNearAccount(NEAR_ACCOUNT_ID, NEAR_ACCOUNT_SK);
    let bnbTransaction = await createBnbTransactionAndGetItsHash();

    let signature = await signPayloadWithMpc(account, MULTI_CHAIN_CONTRACT_ID, bnbTransaction, DERIVATION_PATH);
    console.log("Signature: ", signature);
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