// services/gateway/src/server.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { favorites, ObjectId } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const WORKER_HOSTS = (process.env.WORKER_HOSTS || 'worker').split(',');
const WORKER_PORT  = process.env.WORKER_PORT  || '3000';
const META_HOST    = process.env.META_HOST    || 'meta';
const META_PORT    = process.env.META_PORT    || '3001';

function pickWorker() {
  const list = WORKER_HOSTS.map(s => s.trim()).filter(Boolean);
  return `http://${list[Math.floor(Math.random()*list.length)]}:${WORKER_PORT}`;
}

const app = express();
app.use(express.json());

// Static UI
app.use(express.static(__dirname));

// Health
app.get('/healthz', (req,res)=>res.send('ok'));

// ---- API ----
// helper: make any meta payload into string[]
function normalizeDefs(x) {
  if (!x) return [];
  if (Array.isArray(x)) return x;                 // already ["a","b"]
  if (typeof x === 'string') return [x];          // single string
  // common dictionaryapi.dev shape
  if (Array.isArray(x.meanings)) {
    return x.meanings.flatMap(m =>
      (m.definitions || []).map(d => d.definition).filter(Boolean)
    );
  }
  if (Array.isArray(x.definitions)) return x.definitions;
  return [];
}

app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'q required' });

  try {
    const [rawBooks, rawDef] = await Promise.all([
      fetch(`${pickWorker()}/search?q=${encodeURIComponent(q)}`).then(r => r.json()),
      fetch(`http://${META_HOST}:${META_PORT}/define?q=${encodeURIComponent(q)}`)
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);

    // 🔧 Always give the UI an array
    const books =
      Array.isArray(rawBooks?.books) ? rawBooks.books :
      Array.isArray(rawBooks)        ? rawBooks :
      [];

    const definition = normalizeDefs(rawDef).slice(0, 5);

    res.json({ books, definition });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'search failed' });
  }
});


app.get('/api/favorites', async (req,res)=>{
  res.json(await favorites.find().sort({ _id: -1 }).toArray());
});

app.post('/api/favorites', async (req,res)=>{
  const { title, author, year } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title required' });
  const { insertedId } = await favorites.insertOne({ title, author, year, createdAt: new Date() });
  res.status(201).json({ _id: insertedId, title, author, year });
});

app.delete('/api/favorites/:id', async (req,res)=>{
  try {
    await favorites.deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: 'bad id' });
  }
});

// SPA fallback
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('gateway listening on', PORT));
