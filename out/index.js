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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const nearAPI = __importStar(require("near-api-js"));
const crypto = __importStar(require("crypto"));
const RPC_URL = "https://rpc.testnet.near.org";
const MULTI_CHAIN_CONTRACT_ID = "multichain-dev0.testnet";
const NEAR_ACCOUNT_ID = "test-fastauth-user789.testnet";
const NEAR_ACCOUNT_SK = "ed25519:2FtrAXcQQP9TNL7fKQc8vjQcBLfwfjYu6U3mWMNYMypGk3K3ofQFVFqrPWQoNNKSCASmCYmT3yUnzC9M1cGCWA63";
const DERIVATION_PATH = "bnb";
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        let account = yield initNearAccount(NEAR_ACCOUNT_ID, NEAR_ACCOUNT_SK);
        let bnbTransaction = yield createBnbTransactionAndGetItsHash();
        let signature = yield signPayloadWithMpc(account, MULTI_CHAIN_CONTRACT_ID, bnbTransaction, DERIVATION_PATH);
        console.log("Signature: ", signature);
    });
}
function createBnbTransactionAndGetItsHash() {
    return __awaiter(this, void 0, void 0, function* () {
        // TODO: Implement BNB transaction creation
        const randomBuffer = crypto.randomBytes(32);
        return Uint8Array.from(randomBuffer);
    });
}
function initNearAccount(accountId, secretKey) {
    return __awaiter(this, void 0, void 0, function* () {
        const myKeyStore = new nearAPI.keyStores.InMemoryKeyStore();
        yield myKeyStore.setKey("testnet", accountId, nearAPI.KeyPair.fromString(secretKey));
        const connectionConfig = {
            networkId: "testnet",
            keyStore: myKeyStore,
            nodeUrl: RPC_URL,
        };
        const nearConnection = yield nearAPI.connect(connectionConfig);
        return yield nearConnection.account(accountId);
    });
}
function signPayloadWithMpc(account, multichainContractId, payload, derivationPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const multichainContract = new nearAPI.Contract(account, multichainContractId, {
            changeMethods: ["sign"],
            viewMethods: [],
            abi: undefined,
            useLocalViewExecution: false,
        });
        ;
        return yield multichainContract.sign({
            args: {
                payload: Array.from(payload),
                path: derivationPath,
            },
            gas: "300000000000000"
        });
    });
}
main();
