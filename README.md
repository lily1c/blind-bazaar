# Blind Bazaar

Blind Bazaar is a privacy-preserving AI ad-inventory auction. An advertiser agent negotiates with one or two publisher agents, then the accepted deal is verified by a real [Midnight](https://midnight.network/) Compact contract using zero-knowledge proofs.

The demo shows a simple idea: participants can prove an agreed CPM is within the advertiser's private ceiling and the publisher's private floor, and that delivered quality meets the promised threshold, without revealing those private limits.

> **Hackathon demo status:** the end-to-end flow works on a local Midnight development network. It is not a mainnet deployment and it does not move real money.

## What the demo does

- Streams a live, Groq-powered negotiation between advertiser and publisher agents.
- Detects an accepted deal in the agent transcript.
- Generates a Midnight fairness proof and delivery proof against a deployed Compact contract.
- Shows real contract and transaction identifiers in the browser after verification succeeds.
- Lets the viewer download a privacy-safe JSON proof receipt containing only public verification metadata.
- Stores completed transcript sessions locally in the browser.

```text
Browser UI
    │  live Server-Sent Events
    ▼
Express app + Groq negotiation agents
    │  verified deal input
    ▼
Midnight.js verifier + local wallet
    │  ZK proof requests
    ▼
Local Midnight node + indexer + proof server (Docker)
    │
    ▼
BBoard Compact contract
```

## Privacy model

The proof receipt and the UI never include the private witness values:

- advertiser maximum CPM
- publisher CPM floor
- publisher's actual delivery quality
- wallet seeds, recovery phrases, or private state

The browser displays the negotiated offer because the agents state it publicly in the transcript. The contract proves only the pass/fail conditions. The downloaded receipt contains the contract address, two transaction IDs, verification verdicts, publisher ID, and timestamp—nothing else.

## Quick start

### Prerequisites

- Node.js 22 or newer
- Docker Desktop with at least 4 GB allocated
- [Compact compiler](https://docs.midnight.network/getting-started/installation/) 0.31.1
- A free [Groq API key](https://console.groq.com/keys)

### 1. Configure the Groq key

```bash
cd /path/to/blind-bazaar
cp .env.example .env
```

Set `GROQ_API_KEY` in `.env`. Never commit that file.

### 2. Compile the Compact contract

Both generated binding directories are local build output and are intentionally ignored by Git.

```bash
cd contract
npm install
compact compile src/bboard.compact src/managed/bboard

cd ../blind-bazaar-contract
npm install
npm run compile
```

### 3. Start Midnight and deploy locally

```bash
cd /path/to/blind-bazaar/blind-bazaar-contract
docker compose up -d
docker compose ps
npm run deploy
```

All three services must be healthy: `node`, `indexer`, and `proof-server`.

### 4. Start the app

In a second terminal:

```bash
cd /path/to/blind-bazaar
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) and click **Launch auction**. A full run normally takes about one minute: agent negotiation, wallet sync, fairness proof, then delivery proof.

## Midnight contract

The contract source is [`contract/src/bboard.compact`](contract/src/bboard.compact).

| Circuit | Private witnesses | Public result |
| --- | --- | --- |
| `verifyCredential` | None currently | Checks that a supplied 32-byte credential value is nonempty. This is a deliberate placeholder, not production identity verification. |
| `verifyDealFairness` | Advertiser max CPM; publisher floor CPM | Proves the proposed CPM is within both private bounds, updates `lastDealValid`, and increments `dealCount`. |
| `verifyDelivery` | Publisher actual quality | Proves actual quality meets the promised quality and updates `lastDeliveryValid`. |

Quality ratings shown as decimals, such as `7.8`, are represented in the proof as integer tenths (`78`). Both sides use the same scale, so the comparison is preserved.

## Repository map

```text
public/                         Browser UI and proof-receipt download
server/
  agents/                       Groq advertiser and publisher agents
  negotiation.js                Streams negotiation and requests verification
  midnightReal.js               Starts the real Midnight verifier process
  index.js                      Express server and SSE endpoint
contract/
  src/bboard.compact            Compact source of truth
  src/witnesses.ts              Private witness definitions
blind-bazaar-contract/
  src/deploy.ts                 Deploys BBoard to the selected Midnight network
  src/verify-deal.ts            Generates fairness and delivery proof transactions
  docker-compose.yml            Local node, indexer, and proof-server
```

Other top-level `bboard-*`, `deploy-app`, `api`, and `my-deploy` folders are retained scaffolds and experiments. They are not required for the Blind Bazaar demo path above.

## Commands

| Command | Purpose |
| --- | --- |
| `npm start` | Start the Express application on port 3000. |
| `cd blind-bazaar-contract && docker compose up -d` | Start the local Midnight services. |
| `cd blind-bazaar-contract && npm run compile` | Generate the deployment-side Compact bindings. |
| `cd blind-bazaar-contract && npm run deploy` | Deploy the contract to the selected network; fresh clones default to local devnet. |
| `cd blind-bazaar-contract && npm run verify-deal -- --help` | Show the real verifier input format. |
| `cd blind-bazaar-contract && docker compose down` | Stop the local Midnight services. |

## Important limitations

- The deployed contract used by this demo is on a **local Midnight development network**. Its address changes with a fresh local chain.
- The green `$0.05 demo reward` is UI-only. There is no payment or escrow contract and no token transfer to a publisher.
- `verifyCredential` is intentionally a placeholder until a real credential scheme is chosen.
- The Groq key remains on the server; do not expose it in browser code, screenshots, or Git history.
- This app uses Server-Sent Events. Static hosts such as GitHub Pages cannot run it. For a short public demo, use an HTTP tunnel to the running local app; for persistent hosting, deploy the Express app and the three Midnight Docker services to a server with persistent storage.

## Public-repository safety checklist

Before pushing or changing repository visibility:

- [ ] Confirm `.env`, `.midnight-state.json`, `.midnight-wallet-state/`, `midnight-level-db/`, and generated bindings are ignored.
- [ ] Run `git status --short` and ensure no runtime wallet state is staged.
- [ ] Never add a Groq API key, wallet seed, recovery phrase, or private-state password to Git.
- [ ] Keep the repository's old Preview wallet retired; do not reuse a wallet whose seed appeared in a public repository.

## License

No license has been selected yet. Add one before inviting external reuse of the code.
