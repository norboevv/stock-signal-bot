const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const signalStore = require('./signalStore');
const { isMarketOpen } = require('./marketHours');
const { runCycle } = require('./strategyEngine');
const { getWebhookPath, sendSignal } = require('./telegramBot');

const BACKTEST_FILE = path.join(__dirname, '..', 'data', 'backtest-results.json');

let runCycleInProgress = false; // ustma-ust kelgan cron so'rovlari bir vaqtda ishlamasin

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

/**
 * createApp(bot) — bot parametri ikki narsa uchun kerak: Telegram webhook
 * update'larini qabul qilish, va /api/run-cycle orqali topilgan signallarni
 * obunachilarga yuborish. Ikkalasi ham basicAuth'dan OLDIN ro'yxatdan
 * o'tkaziladi, chunki Telegram va tashqi cron so'rovi Basic Auth
 * header'ini yubormaydi — ular o'z maxfiy token'lari bilan himoyalangan.
 */
function createApp(bot) {
  const app = express();

  if (bot) {
    // Path'ni app.use()ning o'z mount-argumenti sifatida emas, middleware
    // ichida beramiz — aks holda Express uni req.url'dan "kesib tashlaydi"
    // va Telegraf'ning ichki yo'l solishtiruvi (to'liq req.url bilan)
    // mos kelmay, so'rov basicAuth'ga o'tib ketadi.
    app.use(bot.webhookCallback(getWebhookPath()));

    app.get('/api/run-cycle', async (req, res) => {
      if (!config.cron.secret || req.query.token !== config.cron.secret) {
        return res.status(403).json({ error: 'forbidden' });
      }
      if (!isMarketOpen()) {
        return res.json({ skipped: true, reason: 'market_closed' });
      }
      if (runCycleInProgress) {
        return res.json({ skipped: true, reason: 'already_running' });
      }

      runCycleInProgress = true;
      try {
        const signals = await runCycle();
        for (const signal of signals) {
          console.log(`Signal: ${signal.symbol} — ${signal.strategy} — ${signal.type}`);
          await sendSignal(bot, signal);
        }
        res.json({ signals: signals.length });
      } catch (err) {
        console.error('run-cycle xatosi:', err);
        res.status(500).json({ error: err.message });
      } finally {
        runCycleInProgress = false;
      }
    });
  }

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
