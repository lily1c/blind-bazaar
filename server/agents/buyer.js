import { callGroq } from '../groq.js';

/**
 * Advertiser bidding agent. maxBudget is the private max CPM (cost per thousand
 * impressions) it can pay; minQuality is the private minimum audience/inventory
 * quality it will accept. Neither is ever revealed to the publisher.
 */
export function createBuyer({ id = 'advertiser-1', maxBudget, minQuality, campaignBrief = '' }) {
  return {
    id,
    role: 'buyer',
    private: { maxBudget, minQuality },

    async respond(transcript) {
      const briefLine = campaignBrief
        ? `\nCampaign context from the advertiser: "${campaignBrief}"\n`
        : '';
      const systemPrompt = `You are an AI advertiser bidding agent named ${id}, negotiating to buy ad inventory in a real-time auction.
Your real maximum CPM (cost per thousand impressions) you'll pay is ${maxBudget}, and your real minimum acceptable audience/inventory quality score is ${minQuality}.
${briefLine}NEVER state these exact numbers in your messages — negotiate as a real ad buyer would, pushing for a lower CPM while staying vague about your true ceiling.
Only agree to a deal within your true limits.
When you accept a deal, end your message with exactly this line (no extra formatting):
DEAL_ACCEPTED price=<number> quality=<number>
Keep every message to 2-3 sentences.`;
      return callGroq(systemPrompt, transcript);
    }
  };
}
