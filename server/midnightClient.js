/**
 * MOCK ONLY. This matches the interface Person B is building for real on Midnight.
 * Swap the body of these two functions for real Midnight.js calls once Person B's
 * contract is ready — the function signatures and return shapes should not change.
 */

export async function submitDealForVerification(input) {
  await new Promise((r) => setTimeout(r, 1500)); // simulate proof-generation latency

  const { buyer, seller, proposedDeal } = input;
  const priceOk =
    proposedDeal.price <= buyer.maxBudget && proposedDeal.price >= seller.costFloor;
  const qualityOk =
    proposedDeal.promisedQuality >= buyer.minQuality && seller.trueQuality >= buyer.minQuality;
  const valid = priceOk && qualityOk;

  return {
    dealId: input.dealId,
    valid,
    reason: valid ? null : !priceOk ? 'price' : 'quality',
    proofRef: valid ? `mock-proof-${Math.random().toString(36).slice(2, 10)}` : null,
    txId: valid ? `mock-tx-${Math.random().toString(36).slice(2, 10)}` : null
  };
}

export async function getCredentialProof(agentId) {
  await new Promise((r) => setTimeout(r, 400)); // simulate credential proof latency
  return `mock-credential-${agentId}-${Math.random().toString(36).slice(2, 8)}`;
}
