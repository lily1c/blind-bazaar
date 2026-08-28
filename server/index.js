import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { runNegotiation } from './negotiation.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const DEFAULT_CONFIG = {
  buyer: { id: 'advertiser-1', maxBudget: 12, minQuality: 7 },
  sellers: [
    { id: 'publisher-1', costFloor: 6, trueQuality: 8 },
    { id: 'publisher-2', costFloor: 9, trueQuality: 9 }
  ]
};

app.post('/api/negotiate/run', async (req, res) => {
  try {
    const config = req.body?.config || DEFAULT_CONFIG;
    const events = [];
    await runNegotiation(config, (e) => events.push(e));
    res.json({ events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Streams each event the moment it happens (Server-Sent Events), so the
 * frontend can render each chat line as it's actually generated instead of
 * waiting for the whole auction to finish.
 */
app.post('/api/negotiate/stream', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });

  const send = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    const config = req.body?.config || DEFAULT_CONFIG;
    await runNegotiation(config, send);
  } catch (err) {
    console.error(err);
    send({ type: 'error', message: err.message });
  } finally {
    res.end();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Blind Bazaar (Person A) running at http://localhost:${PORT}`);
});
