const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const signalStore = require('./signalStore');
const { isMarketOpen } = require('./marketHours');

const BACKTEST_FILE = path.join(__dirname, '..', 'data', 'backtest-results.json');

function basicAuth(req, res, next) {
  const password = config.server.dashboardPassword;
  if (!password) return next();

  const header = req.headers.authorization || '';
  const [, encoded] = header.split(' ');
  const decoded = encoded ? Buffer.from(encoded, 'base64').toString() : '';
  const [, pass] = decoded.split(':');
  if (pass === password) return next();

  res.set('WWW-Authenticate', 'Basic realm="Stock Signal Dashboard"');
  return res.status(401).send('Autentifikatsiya talab qilinadi');
}

function createApp() {
  const app = express();
  app.use(basicAuth);
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/api/status', (req, res) => {
    res.json({
      marketOpen: isMarketOpen(),
      symbols: config.symbols,
      timezone: config.marketTimezone,
      serverTime: new Date().toISOString(),
    });
  });

  app.get('/api/signals', (req, res) => {
    const { symbol, limit } = req.query;
    const n = Math.min(Number(limit) || 100, 500);
    const records = symbol
      ? signalStore.getSignalsBySymbol(String(symbol).toUpperCase(), n)
      : signalStore.getRecentSignals(n);
    res.json(records);
  });

  app.get('/api/backtest', (req, res) => {
    if (!fs.existsSync(BACKTEST_FILE)) {
      return res.json({ generatedAt: null, results: {} });
    }
    try {
      res.json(JSON.parse(fs.readFileSync(BACKTEST_FILE, 'utf8')));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}

module.exports = { createApp };
