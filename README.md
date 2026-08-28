# Blind Bazaar — Person A (Agents & Frontend, Groq only)

## What this is
An advertiser agent bids blind against two competing publisher agents in a real-time ad auction, powered by Groq (Llama 3.3 70B). Each agent's real CPM ceiling/floor and quality bar stay private — never revealed to the other side or to each other. Each auction's outcome is sent to a mock `submitDealForVerification` function matching the exact interface Person B is building on Midnight — swap that mock out once their contract is ready.

## What's new in this version
- **Real streaming** — the server sends each chat line the moment it's generated (Server-Sent Events on `/api/negotiate/stream`), so the UI updates live instead of waiting for the whole auction to finish.
- **Campaign brief input** — optional free-text field at the top; whatever you type gets included in the advertiser agent's system prompt as context, and also becomes the chat name (e.g. "Sneaker Campaign").
- **Activity tab is now an iMessage-style bubble chat** — shows only extracted values ($ CPM, quality score) per message, not the full sentence, with typing-indicator bubbles while an agent is "thinking." The full verbose transcript still lives in the side panel.
- **Micropayment on selection** — when a publisher's deal is verified valid, they get a small "+$0.05 earned" badge in the Agents panel and a system bubble announcing it in the chat. This is a cosmetic score for the demo, not a real payment.
- **Sessions tab** — sits next to Agents in the left panel. Every completed run is saved to the browser's local storage and listed there (name, timestamp, valid/invalid indicator); click one to load its full transcript back into the side panel.
- **Save-before-restart** — clicking "Launch auction" again after a completed run prompts you to save the previous log as a `.txt` file first. There's also a manual "Download this log" button under the transcript panel.
- **Hover states** — agent rows, chat bubbles, and proof cards scale up slightly on hover.

Note: value extraction from agent messages uses simple regex ($ amounts, "quality N" mentions) — if an agent phrases something unusually, the bubble may just show "…" until it says a recognizable number.

## Setup

```bash
npm install
cp .env.example .env
# then edit .env and add your Groq API key
npm start
```

Open http://localhost:3000 and click "Launch auction."

Get a free Groq API key at console.groq.com — no credit card required. Free tier is 30 requests/minute, so the loop waits ~2.2 seconds between calls.

## Structure

```
server/
  index.js          Express server + API route
  groq.js            Groq API wrapper (OpenAI-compatible endpoint, Llama 3.3 70B)
  negotiation.js     Orchestrates buyer vs each seller, blind
  midnightClient.js  MOCK — matches Person B's real interface exactly
  agents/
    buyer.js
    seller.js
public/
  index.html
  app.js             Renders chat transcript + proof panel
  styles.css
```

## The interface with Person B

Two functions, both currently mocked in `server/midnightClient.js`:

```ts
submitDealForVerification({
  dealId, buyer: {id, maxBudget, minQuality},
  seller: {id, costFloor, trueQuality},
  proposedDeal: {price, promisedQuality},
  credential: {agentId, credentialProof}
}) → { dealId, valid, reason, proofRef, txId }

getCredentialProof(agentId) → credentialProofString
```

When Person B's real Midnight.js + Compact contract is ready, replace the bodies of these two functions in `midnightClient.js` — nothing else needs to change.

## Notes
- Private fields (`maxBudget`, `minQuality`, `costFloor`, `trueQuality`) live only inside each agent's own object and the final verification call — never printed to the transcript or sent to the other agent.
- `DEAL_LINE` regex looks for `DEAL_ACCEPTED price=<n> quality=<n>` in agent replies to detect a struck deal.
- If Groq returns a 429, `groq.js` automatically waits 5s and retries once.
