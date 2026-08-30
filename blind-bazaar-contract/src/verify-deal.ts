import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';

import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';

import { resolveNetwork, getDeployment, getOrCreateWallet } from './network';
import { createWallet, persistWalletState, type WalletContext } from './wallet';
import * as BBoard from '../contracts/managed/bboard/contract/index.js';
import { createBBoardPrivateState, witnesses } from '../../contract/src/witnesses.ts';

// @ts-expect-error Required for wallet sync subscriptions.
globalThis.WebSocket = WebSocket;

const PRIVATE_STATE_ID = 'blindBazaarPrivateState';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const zkConfigPath = path.resolve(__dirname, '..', 'contracts', 'managed', 'bboard');

type DealInput = {
  dealId: string;
  buyer: { id: string; maxBudget: number; minQuality: number };
  seller: { id: string; costFloor: number; trueQuality: number };
  proposedDeal: { price: number; promisedQuality: number };
  credential: { agentId: string; credentialProof: string };
};

function progress(stage: string, message: string) {
  process.stdout.write(`BLIND_BAZAAR_PROGRESS=${JSON.stringify({ stage, message })}\n`);
}

function result(payload: Record<string, unknown>) {
  process.stdout.write(`BLIND_BAZAAR_RESULT=${JSON.stringify(payload)}\n`);
}

function cpmToCents(value: number, field: string): bigint {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${field} must be a non-negative number`);
  return BigInt(Math.round(value * 100));
}

function qualityToTenths(value: number, field: string): bigint {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a non-negative number`);
  }
  // The product presents ratings such as 7.8. Compact's Uint<64> accepts
  // integers, so represent ratings in tenths inside the proof (7.8 -> 78).
  // Both sides are converted identically, preserving the >= comparison.
  return BigInt(Math.round(value * 10));
}

function loadInput(): DealInput | null {
  if (process.argv[2] === '--help') {
    console.log('Usage: node --import tsx src/verify-deal.ts \'<deal JSON>\'');
    return null;
  }
  if (!process.argv[2]) throw new Error('Missing deal JSON input');
  return JSON.parse(process.argv[2]) as DealInput;
}

async function createProviders(walletCtx: WalletContext) {
  const { config: networkConfig } = resolveNetwork();
  const privateStatePassword = process.env.PRIVATE_STATE_PASSWORD?.trim()
    || 'Local-Devnet-Development-Placeholder-1';
  const walletProvider = {
    coinPublicKey: walletCtx.shieldedSecretKeys.coinPublicKey,
    encryptionPublicKey: walletCtx.shieldedSecretKeys.encryptionPublicKey,
    getCoinPublicKey: () => walletCtx.shieldedSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => walletCtx.shieldedSecretKeys.encryptionPublicKey,
    async balanceTx(tx: unknown, ttl?: Date) {
      const recipe = await walletCtx.wallet.balanceUnboundTransaction(
        tx as never,
        { shieldedSecretKeys: walletCtx.shieldedSecretKeys, dustSecretKey: walletCtx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      return walletCtx.wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx: unknown) => walletCtx.wallet.submitTransaction(tx as never) as never,
  };
  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
  const accountId = walletCtx.unshieldedKeystore.getBech32Address().toString();
  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'blind-bazaar-state',
      accountId,
      privateStoragePasswordProvider: () => privateStatePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(networkConfig.indexer, networkConfig.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(networkConfig.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
}

async function main() {
  const input = loadInput();
  if (!input) return;
  if (!fs.existsSync(path.join(zkConfigPath, 'contract', 'index.js'))) {
    throw new Error('BBoard contract is not compiled. Run npm run compile first.');
  }

  const { network, config: networkConfig } = resolveNetwork();
  const deployment = getDeployment(network);
  if (!deployment) {
    throw new Error(`No BBoard deployment for ${network}. Run npm run deploy first.`);
  }

  const maxCPM = cpmToCents(input.buyer.maxBudget, 'buyer.maxBudget');
  const floorCPM = cpmToCents(input.seller.costFloor, 'seller.costFloor');
  const price = cpmToCents(input.proposedDeal.price, 'proposedDeal.price');
  const promisedQuality = qualityToTenths(input.proposedDeal.promisedQuality, 'proposedDeal.promisedQuality');
  const actualQuality = qualityToTenths(input.seller.trueQuality, 'seller.trueQuality');
  const credentialValid = /^[0-9a-f]{64}$/i.test(input.credential.credentialProof);

  progress('wallet', `Connecting Midnight wallet on ${network}…`);
  const wallet = getOrCreateWallet(network);
  const walletCtx = await createWallet({ network, networkConfig, seed: wallet.seed });
  try {
    progress('sync', 'Syncing wallet with Midnight…');
    await walletCtx.wallet.waitForSyncedState();
    const providers = await createProviders(walletCtx);
    const compiledContract = CompiledContract.make('BBoard', BBoard.Contract).pipe(
      CompiledContract.withWitnesses(witnesses),
      CompiledContract.withCompiledFileAssets(zkConfigPath),
    );
    const privateState = {
      ...createBBoardPrivateState(maxCPM, floorCPM, actualQuality),
      zswapLocalState: { coinPublicKey: walletCtx.shieldedSecretKeys.coinPublicKey },
    };
    const deployed: any = await findDeployedContract(providers, {
      compiledContract: compiledContract as any,
      contractAddress: deployment.address,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: privateState as any,
    });

    progress('fairness', 'Generating zero-knowledge fairness proof…');
    const fairnessTx = await deployed.callTx.verifyDealFairness(price);
    progress('delivery', 'Generating zero-knowledge delivery proof…');
    const deliveryTx = await deployed.callTx.verifyDelivery(promisedQuality);
    progress('confirmed', 'Midnight proofs confirmed.');

    result({
      dealId: input.dealId,
      valid: true,
      credentialValid,
      fairnessValid: true,
      deliveryValid: true,
      contractAddress: deployment.address,
      txId: fairnessTx.public.txId,
      deliveryTxId: deliveryTx.public.txId,
    });
  } finally {
    await persistWalletState(network, walletCtx);
    await walletCtx.wallet.stop();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  result({ valid: false, reason: message });
  process.exitCode = 1;
});
