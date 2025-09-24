const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

const SAMPLE = [
  { title: "A Writer's Reference", author: "Diana Hacker", year: 1989 },
  { title: "Geographia", author: "Ptolemy", year: 1478 }
];

function normalizeOL(doc) {
  return {
    title: doc?.title || '',
    author: Array.isArray(doc?.author_name) ? doc.author_name[0] : '',
    year: doc?.first_publish_year ?? null
  };
}

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const useOpenLib = /^(1|true|yes)$/i.test(process.env.OPENLIB || '');

  try {
    if (useOpenLib && q) {
      const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=10`;
      const r = await fetch(url, { headers: { 'User-Agent': 'bookbooker/1.0' } });
      if (!r.ok) throw new Error(`openlibrary ${r.status}`);
      const data = await r.json();
      const books = Array.isArray(data.docs) ? data.docs.slice(0, 10).map(normalizeOL) : [];
      return res.json({ books });
    } else {
      const ql = q.toLowerCase();
      const books = q
        ? SAMPLE.filter(b => [b.title, b.author, String(b.year)].some(v => v.toLowerCase().includes(ql)))
        : [];
      return res.json({ books });
    }
  } catch (err) {
    console.error('worker /search error:', err?.message || err);
    // Never make gateway fail—return an empty list instead of 5xx
    return res.status(200).json({ books: [] });
  }
});

app.listen(PORT, () => console.log(`worker listening on ${PORT}`));
