import { chainAdapters, constants, contracts } from "signet.js";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import dotenv from 'dotenv';

dotenv.config();

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const publicClient = createPublicClient({ chain: sepolia, transport: http() });
const walletClient = createWalletClient({ account, chain: sepolia, transport: http() });

const evmChainSigContract = new contracts.evm.ChainSignatureContract({
  publicClient,
  walletClient,
  contractAddress: constants.CONTRACT_ADDRESSES.ETHEREUM.TESTNET_DEV as `0x${string}`,
});