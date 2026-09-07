const express = require('express');
const path = require('path');
const helmet = require('helmet');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3001;
const API_ORIGIN = process.env.API_ORIGIN || 'http://localhost:5000';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", API_ORIGIN, API_ORIGIN.replace('http', 'ws')],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:']
    }
  }
}));

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  }
}));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

const PAGES = ['index', 'orders', 'menu-management', 'earnings', 'settings', 'login'];
PAGES.forEach(p => {
  app.get('/' + p + '.html', (req, res) =>
    res.sendFile(path.join(__dirname, 'public', p + '.html'))
  );
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Vendor portal on http://localhost:${PORT}`);
});