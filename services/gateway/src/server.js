// services/gateway/src/server.js
const express = require('express');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
app.use(express.json());

// --- config ---
const PORT = process.env.PORT || 3000;
const WORKER_HOSTS = (process.env.WORKER_HOSTS || 'http://worker:3000')
  .split(',').map(s => s.trim()).filter(Boolean);
const META_URL = process.env.META_URL || process.env.META_HOST || 'http://meta:3001';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://textstore:27017/bookbooker';
const DB_NAME = process.env.DB_NAME || 'bookbooker';

// --- HTTP helpers with hard timeouts ---
async function safeFetchJson(url, { timeoutMs = 4000 } = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    // try JSON, but if body is empty / html, catch & fall back
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Non-JSON from ${url}: ${text.slice(0, 120)}`);
    }
  } finally {
    clearTimeout(t);
  }
}

function pickWorker() {
  return WORKER_HOSTS[Math.floor(Math.random() * WORKER_HOSTS.length)];
}

// --- Mongo (lazy) ---
let mongoClient, favoritesColl;
async function getFavoritesColl() {
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGO_URI, { connectTimeoutMS: 3000, serverSelectionTimeoutMS: 3000 });
    await mongoClient.connect();
    favoritesColl = mongoClient.db(DB_NAME).collection('favorites');
    await favoritesColl.createIndex({ createdAt: -1 });
  }
  return favoritesColl;
}

// --- static UI ---
app.use(express.static(path.join(__dirname))); // index.html lives here

// --- health ---
app.get('/healthz', (_req, res) => res.type('text/plain').send('ok'));

// --- search aggregator ---
app.get('/api/search', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const workerUrl = `${pickWorker()}/search?q=${encodeURIComponent(q)}`;
    const metaUrl   = `${META_URL}/define?q=${encodeURIComponent(q)}`;

    const [booksRes, defsRes] = await Promise.allSettled([
      safeFetchJson(workerUrl).then(r => Array.isArray(r) ? r : (Array.isArray(r?.books) ? r.books : [])),
      safeFetchJson(metaUrl).then(r => Array.isArray(r) ? r : (Array.isArray(r?.definition) ? r.definition : [])),
    ]);

    const books = booksRes.status === 'fulfilled' ? booksRes.value : [];
    const definition = defsRes.status === 'fulfilled' ? defsRes.value : [];

    res.json({ books, definition });
  } catch (err) {
    // absolute last-resort safety net
    console.error('gateway /api/search fatal:', err?.stack || err);
    res.json({ books: [], definition: [], warning: 'gateway-fallback' });
  }
});

// --- favorites CRUD ---
app.get('/api/favorites', async (_req, res, next) => {
  try {
    const coll = await getFavoritesColl();
    const docs = await coll.find().sort({ createdAt: -1 }).toArray();
    res.json(docs);
  } catch (err) { next(err); }
});

app.post('/api/favorites', async (req, res, next) => {
  try {
    const { title, author, year } = req.body || {};
    if (!title) return res.status(400).json({ error: 'title required' });
    const coll = await getFavoritesColl();
    const doc = { title, author, year, createdAt: new Date() };
    const r = await coll.insertOne(doc);
    res.json({ _id: r.insertedId, ...doc });
  } catch (err) { next(err); }
});

app.delete('/api/favorites/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!/^[a-f0-9]{24}$/i.test(id)) return res.status(400).json({ error: 'bad id' });
    const coll = await getFavoritesColl();
    const r = await coll.deleteOne({ _id: new ObjectId(id) });
    res.json({ deleted: r.deletedCount === 1 });
  } catch (err) { next(err); }
});

// --- error middleware: NEVER crash a request ---
app.use((err, _req, res, _next) => {
  console.error('Unhandled app error:', err?.stack || err);
  // Still reply with safe shape for the UI & tests
  if (!res.headersSent) {
    res.status(200).json({ books: [], definition: [], warning: 'gateway-error' });
  }
});

// --- process guards (log, don’t exit) ---
process.on('unhandledRejection', (r) => console.error('unhandledRejection', r));
process.on('uncaughtException', (e) => console.error('uncaughtException', e));

// --- start ---
app.listen(PORT, () => console.log(`gateway listening on ${PORT}`));
