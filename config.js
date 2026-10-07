require('dotenv').config();

module.exports = {
  // Kuzatilayotgan aksiyalar — foydalanuvchi tanlagan qisqa ro'yxat (21 ta).
  // Ro'yxat qisqa bo'lgani uchun strategiya tsikli tez tugaydi. Yahoo'da
  // topilmagan ticker xato bermaydi — log'ga yoziladi va o'tkazib yuboriladi.
  symbols: [
    'AEHR', 'ALAB', 'ANET', 'APLD', 'APP', 'AVGO', 'CBRS', 'CRDO', 'CIEN', 'CRWD', 'HIMS',
    'IREN', 'MRVL', 'MSTR', 'MU', 'NVDA', 'NOW', 'SNDK', 'SPCX', 'ZETA', 'RDDT',
  ],

  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
    // Webhook manzilining bir qismi — taxmin qilib bo'lmaydigan yo'l orqali
    // Telegram'dan boshqa hech kim shu endpoint'ga soxta update yubora olmasligi uchun.
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
  },

  // Shared hosting (Passenger) so'rovlar orasida process'ni "tirik" ushlab
  // turmagani uchun, fon rejimidagi ichki cron (node-cron) o'rniga tashqi
  // cPanel Cron Job /api/run-cycle manziliga so'rov yuborib, strategiya
  // tsiklini bitta HTTP so'rov ichida ishga tushiradi. Bu maxfiy token shu
  // so'rovni tasodifiy tashrif buyuruvchilardan himoya qiladi.
  cron: {
    secret: process.env.CRON_SECRET,
  },

  server: {
    port: process.env.PORT || 3000,
    dashboardPassword: process.env.DASHBOARD_PASSWORD || 'change-me',
    // cPanel/Passenger'da ilova o'ziga tegishli to'liq domen manzilini
    // bilmaydi (faqat localhost:PORT eshitadi) — webhook ro'yxatdan
    // o'tkazish uchun bu tashqi (public) manzil qo'lda beriladi.
    publicUrl: process.env.PUBLIC_URL,
  },

  // Har bir strategiya uchun sozlamalar
  strategies: {
    rsi: {
      enabled: false,
      period: 14,
      oversold: 30,
      overbought: 70,
    },
    maCrossover: {
      enabled: false,
      fastPeriod: 50,
      slowPeriod: 200,
    },
    supportResistance: {
      enabled: true,
      lookbackDays: 20,
    },
    volumeSpike: {
      enabled: false,
      lookbackDays: 20,
      multiplier: 2,
      windowMinutes: 15,
    },
    macd: {
      enabled: false,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
    },
    bollingerBands: {
      enabled: false,
      period: 20,
      stdDev: 2,
    },
    // timeframe: '1m' — 1 daqiqalik (tugagan) candle'lar; '1d' (yoki berilmasa)
    // — kunlik. lookbackMinutes (faqat 1m uchun) cron intervalidan kamida 2
    // baravar katta bo'lishi kerak, aks holda cron orasida sodir bo'lgan
    // signallar o'tkazib yuboriladi.
    rsiReversal: {
      enabled: true,
      period: 14,
      oversoldThreshold: 30,
      timeframe: '1m',
      lookbackMinutes: 10,
    },
    emaCrossover: {
      enabled: true,
      timeframe: '1m',
      lookbackMinutes: 10,
      pairs: [
        { fastPeriod: 9, slowPeriod: 21 },
      ],
    },
    // Narx VWAP'ni pastdan tepaga kesib o'tishi (1 daqiqalik candle'lardan
    // hisoblangan sessiya VWAP'i). lookbackMinutes cron intervalidan kamida
    // 2 baravar katta bo'lishi kerak, aks holda cron orasidagi kesishlar
    // o'tkazib yuboriladi.
    vwapCross: {
      enabled: true,
      minCandles: 15,
      lookbackMinutes: 10,
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
