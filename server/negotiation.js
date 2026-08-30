import { createBuyer } from './agents/buyer.js';
import { createSeller } from './agents/seller.js';
import { submitDealForVerification, getCredentialProof } from './midnightReal.js';

const DEAL_LINE = /DEAL_ACCEPTED\s+price=([\d.]+)\s+quality=([\d.]+)/i;
const MAX_ROUNDS = 6;
const ROUND_DELAY_MS = 2200; // stay comfortably under Groq's 30 req/min free-tier limit

/**
 * Runs the auction and calls onEvent(event) the moment each thing happens,
 * so the caller (an SSE route) can push it to the browser immediately —
 * no waiting for the whole auction to finish.
 *
 * Event shapes:
 *  { type: 'header', buyerId, sellerId }
 *  { type: 'line', sellerId, speaker, text }
 *  { type: 'proof', sellerId, agreedPrice, agreedQuality, verification }
 *  { type: 'done' }
 */
export async function runNegotiation(config, onEvent = () => {}) {
  const buyer = createBuyer(config.buyer);
  const sellers = config.sellers.map(createSeller);

  const credentials = {};
  for (const agent of [buyer, ...sellers]) {
    credentials[agent.id] = await getCredentialProof(agent.id);
  }

  for (const seller of sellers) {
    onEvent({ type: 'header', buyerId: buyer.id, sellerId: seller.id });

    const transcriptLines = [];
    let agreedPrice = null;
    let agreedQuality = null;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const buyerContext =
        transcriptLines.join('\n') || `Negotiation start for a deal with ${seller.id}.`;
      const buyerMsg = await buyer.respond(buyerContext);
      transcriptLines.push(`${buyer.id}: ${buyerMsg}`);
      onEvent({ type: 'line', sellerId: seller.id, speaker: buyer.id, text: buyerMsg });
      await new Promise((r) => setTimeout(r, ROUND_DELAY_MS));

      let match = buyerMsg.match(DEAL_LINE);
      if (match) {
        agreedPrice = parseFloat(match[1]);
        agreedQuality = parseFloat(match[2]);
        break;
      }

      const sellerMsg = await seller.respond(transcriptLines.join('\n'));
      transcriptLines.push(`${seller.id}: ${sellerMsg}`);
      onEvent({ type: 'line', sellerId: seller.id, speaker: seller.id, text: sellerMsg });
      await new Promise((r) => setTimeout(r, ROUND_DELAY_MS));

      match = sellerMsg.match(DEAL_LINE);
      if (match) {
        agreedPrice = parseFloat(match[1]);
        agreedQuality = parseFloat(match[2]);
        break;
      }
    }

    let verification = null;
    if (agreedPrice !== null) {
      verification = await submitDealForVerification({
        dealId: `${buyer.id}-${seller.id}-${Date.now()}`,
        buyer: {
          id: buyer.id,
          maxBudget: buyer.private.maxBudget,
          minQuality: buyer.private.minQuality
        },
        seller: {
          id: seller.id,
          costFloor: seller.private.costFloor,
          trueQuality: seller.private.trueQuality
        },
        proposedDeal: { price: agreedPrice, promisedQuality: agreedQuality },
        credential: { agentId: seller.id, credentialProof: credentials[seller.id] }
      }, (progress) => {
        onEvent({ type: 'midnight-progress', sellerId: seller.id, progress });
      });
    }

    onEvent({ type: 'proof', sellerId: seller.id, agreedPrice, agreedQuality, verification });
  }

  onEvent({ type: 'done' });
}
