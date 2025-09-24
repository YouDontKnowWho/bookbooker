const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

async function define(q) {
  try {
    // dictionaryapi.dev free endpoint
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(q)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const defs = [];
    for (const e of (Array.isArray(data) ? data : [])) {
      for (const m of (Array.isArray(e.meanings) ? e.meanings : [])) {
        for (const d of (Array.isArray(m.definitions) ? m.definitions : [])) {
          if (d.definition) defs.push(d.definition);
        }
      }
    }
    return defs.slice(0, 5);
  } catch (e) {
    console.error('define error:', e.message);
    return []; // fallback, never throw
  }
}

app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.get('/define', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const out = q ? await define(q) : [];
  res.json(out);
});

app.listen(PORT, () => console.log(`meta listening on ${PORT}`));
