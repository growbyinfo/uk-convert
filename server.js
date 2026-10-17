const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;
const startedAt = new Date();

app.disable('x-powered-by');
// allow embedding in your own site (change * to https://ssyoutube.is if you want to lock it)
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', 'frame-ancestors *');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Service start / status API
app.get('/api/start', (req, res) => {
  res.json({ service: 'uk-convert', status: 'running', startedAt, uptimeSec: Math.round(process.uptime()) });
});

// Health check (use this path in Northflank health checks)
app.get('/api/health', (req, res) => res.status(200).send('ok'));

// Video title + thumbnail
app.get('/api/info', async (req, res) => {
  const id = String(req.query.id || '');
  if (!/^[\w-]{11}$/.test(id)) return res.status(400).json({ error: 'invalid video id' });
  try {
    const r = await fetch('https://www.youtube.com/oembed?format=json&url=' +
      encodeURIComponent('https://www.youtube.com/watch?v=' + id));
    if (!r.ok) return res.status(404).json({ error: 'video not found' });
    const d = await r.json();
    res.json({ id, title: d.title, author: d.author_name, thumbnail: 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg' });
  } catch (e) {
    res.status(502).json({ error: 'lookup failed' });
  }
});

app.listen(PORT, '0.0.0.0', () => console.log('uk-convert running on port ' + PORT));
