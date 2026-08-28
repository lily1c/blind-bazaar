import fetch from 'node-fetch';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'openai/gpt-oss-120b';

/**
 * Calls Groq (OpenAI-compatible chat completions endpoint) with a system prompt
 * and the running transcript. Same call shape as gemini.js so llmProvider.js
 * can swap between them with zero changes to the agents.
 */
export async function callGroq(systemPrompt, transcriptText) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GROQ_API_KEY — copy .env.example to .env and add your key.');
  }

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Conversation so far:\n${transcriptText}` }
      ]
    })
  });

  if (res.status === 429) {
    const errBody = await res.json().catch(() => null);
    console.log(
      'Groq rate limited — waiting 5s before retrying...',
      errBody?.error?.message || ''
    );
    await new Promise((r) => setTimeout(r, 5000));
    return callGroq(systemPrompt, transcriptText); // retry once, recursively
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('Groq returned no text: ' + JSON.stringify(data));
  }
  return text.trim();
}
