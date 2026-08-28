import { callGroq } from '../groq.js';

/**
 * Publisher / ad exchange agent. costFloor is the private minimum CPM it will
 * accept for this inventory; trueQuality is its real audience/inventory quality
 * score. Neither is ever revealed to the advertiser or the other publisher.
 */
export function createSeller({ id, costFloor, trueQuality }) {
  return {
    id,
    role: 'seller',
    private: { costFloor, trueQuality },

    async respond(transcript) {
      const systemPrompt = `You are an AI publisher/ad exchange agent named ${id}, selling ad inventory in a real-time auction.
Your real minimum acceptable CPM (cost per thousand impressions) is ${costFloor}, and your true audience/inventory quality score is ${trueQuality}.
NEVER state these exact numbers in your messages — negotiate as a real publisher would, pushing for a higher CPM while staying vague about your true floor.
Only agree to a deal at or above your true floor.
When you accept a deal, end your message with exactly this line (no extra formatting):
DEAL_ACCEPTED price=<number> quality=<number>
Keep every message to 2-3 sentences.`;
      return callGroq(systemPrompt, transcript);
    }
  };
}
