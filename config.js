require('dotenv').config();

module.exports = {
  // Kuzatilayotgan aksiyalar
  symbols: ['AKAM', 'MRVL', 'CRDO', 'NOW', 'GOOGL', 'TSLA', 'NVDA', 'MU', 'INTC', 'AEHR', 'ZS'],

  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  },

  server: {
    port: process.env.PORT || 3000,
    dashboardPassword: process.env.DASHBOARD_PASSWORD || 'change-me',
  },

  // Har bir strategiya uchun sozlamalar
  strategies: {
    rsi: {
      enabled: true,
      period: 14,
      oversold: 30,
      overbought: 70,
    },
    maCrossover: {
      enabled: true,
      fastPeriod: 50,
      slowPeriod: 200,
    },
    supportResistance: {
      enabled: true,
      lookbackDays: 20,
    },
    volumeSpike: {
      enabled: true,
      lookbackDays: 20,
      multiplier: 2,
      windowMinutes: 15,
    },
    macd: {
      enabled: true,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
    },
    bollingerBands: {
      enabled: true,
      period: 20,
      stdDev: 2,
    },
  },

  // Bitta symbol/strategiya juftligi bir xabardan keyin necha daqiqa jim tursin
  cooldownMinutes: 30,

  // Bozorni tekshirish sikli (millisekund) — node-cron uchun cron ifodasi scheduler.js'da
  marketTimezone: 'America/New_York',

  // Backtesting sozlamalari
  backtest: {
    lookbackYears: 2,
    forwardWindows: [5, 10, 20], // signal'dan keyingi N kunlik forward return
  },
};
