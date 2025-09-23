import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// Liten lokal “katalog” för offline/demo.
// Sätt OPENLIB=1 för att instead hämta från Open Library (internet krävs).
const SAMPLE = [
  { title: 'War and Peace', author: 'Leo Tolstoy', year: 1869 },
  { title: 'Anna Karenina', author: 'Leo Tolstoy', year: 1878 },
  { title: 'Pride and Prejudice', author: 'Jane Austen', year: 1813 },
  { title: 'Crime and Punishment', author: 'Fyodor Dostoevsky', year: 1866 },
  { title: 'The Brothers Karamazov', author: 'Fyodor Dostoevsky', year: 1880 }
];

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'missing q' });

  try {
    if (process.env.OPENLIB === '1') {
      const url = 'https://openlibrary.org/search.json?q=' + encodeURIComponent(q);
      const r = await fetch(url);
      const j = await r.json();
      const books = (j.docs || []).slice(0, 10).map(d => ({
        title: d.title,
        author: (d.author_name && d.author_name[0]) || 'unknown',
        year: d.first_publish_year || null
      }));
      return res.json({ source: 'openlibrary', books });
    }

    // Lokal sökning
    const tokens = q.toLowerCase().split(/\s+/);
    const scored = SAMPLE.map(b => {
      const hay = `${b.title} ${b.author}`.toLowerCase();
      const hits = tokens.filter(t => hay.includes(t)).length;
      return { score: hits, ...b };
    }).filter(x => x.score === tokens.length) // kräver match på alla tokens
      .sort((a,b) => b.score - a.score);

    res.json({ source: 'local', books: scored.map(({score, ...b}) => b) });
  } catch (e) {
    res.status(500).json({ error: 'worker search error' });
  }
});

app.listen(PORT, () => console.log(`worker listening on ${PORT}`));
