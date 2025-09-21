import express from 'express';

const app = express();
const PORT = process.env.PORT || 3001;

app.get('/healthz', (_req, res) => res.json({ ok: true }));

// GET /define?word=example  -> dictionaryapi.dev
app.get('/define', async (req, res) => {
  try {
    const word = (req.query.word || '').trim();
    if (!word) return res.status(400).json({ error: 'missing word' });

    const r = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!r.ok) return res.status(r.status).json({ error: 'lookup failed' });
    const data = await r.json();

    const defs = (data[0]?.meanings ?? [])
      .flatMap(m => m.definitions ?? [])
      .slice(0, 3)
      .map(d => d.definition);

    res.json({ word, definitions: defs });
  } catch {
    res.status(500).json({ error: 'meta error' });
  }
});

// GET /author?name=tolstoy  -> OpenLibrary
app.get('/author', async (req, res) => {
  try {
    const name = (req.query.name || '').trim();
    if (!name) return res.status(400).json({ error: 'missing name' });

    const r = await fetch(`https://openlibrary.org/search/authors.json?q=${encodeURIComponent(name)}`);
    if (!r.ok) return res.status(r.status).json({ error: 'lookup failed' });
    const data = await r.json();

    const top = (data?.docs ?? []).slice(0, 1).map(a => ({
      name: a.name,
      top_work: a.top_work ?? null,
      work_count: a.work_count ?? null
    }))[0] ?? null;

    res.json({ query: name, author: top });
  } catch {
    res.status(500).json({ error: 'meta error' });
  }
});

app.listen(PORT, () => {
  console.log(`meta listening on ${PORT}`);
});
