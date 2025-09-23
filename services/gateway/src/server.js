// services/gateway/src/server.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 3000;

const WORKER_HOST = process.env.WORKER_HOST || 'worker';
const WORKER_PORT = process.env.WORKER_PORT || '3000';
const META_HOST   = process.env.META_HOST   || 'meta';
const META_PORT   = process.env.META_PORT   || '3001';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

app.use(express.json());

// health
app.get('/healthz', (_req, res) => res.send('ok'));

// serve UI (index.html lives in src/)
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// proxy → worker: search books
app.get('/api/search', async (req, res) => {
  const q = encodeURIComponent(req.query.q || '');
  try {
    const r = await fetch(`http://${WORKER_HOST}:${WORKER_PORT}/search?q=${q}`);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: 'worker_unreachable', detail: e.message });
  }
});

// proxy → meta: list favorites
app.get('/api/favorites', async (_req, res) => {
  try {
    const r = await fetch(`http://${META_HOST}:${META_PORT}/favorites`);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: 'meta_unreachable', detail: e.message });
  }
});

// proxy → meta: add favorite
app.post('/api/favorites', async (req, res) => {
  try {
    const r = await fetch(`http://${META_HOST}:${META_PORT}/favorites`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(502).json({ error: 'meta_unreachable', detail: e.message });
  }
});

app.listen(PORT, () => console.log('gateway listening on', PORT));
