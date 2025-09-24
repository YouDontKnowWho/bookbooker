// services/worker/src/server.js
import express from 'express';

const app = express();

// liveness
app.get('/healthz', (req, res) => res.send('ok'));

// search books via Open Library
app.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);

  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=10`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`upstream ${r.status}`);
    const data = await r.json();

    const books = (data.docs || []).slice(0, 10).map(d => ({
      title: d.title || 'Untitled',
      author: Array.isArray(d.author_name) ? d.author_name[0] : d.author_name || 'Unknown',
      year: d.first_publish_year || null
    }));

    res.json(books);
  } catch (e) {
    console.error('worker search error:', e.message);
    res.json([]); // fail-soft
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('worker listening on', PORT));
