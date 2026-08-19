require('dotenv').config();

module.exports = {
  // Kuzatilayotgan aksiyalar — dastlabki 11 tasi + "halol aksiyalar" ro'yxatidan
  // tanlangan yirik/likvid ~103 tasi (harbiy/qurol kompaniyalari — LMT, RTX, NOC,
  // LHX, TXT, GD — bahsli toifa sifatida chiqarib tashlandi). Diqqat: bu faqat
  // faoliyat sohasi bo'yicha tezkor ko'rikdan o'tgan — moliyaviy nisbatlar
  // (qarz/foiz daromadi) tekshirilmagan, to'liq ishonch uchun Zoya/Musaffa kabi
  // ilovada qayta tekshiring.
  symbols: [
    'AKAM', 'MRVL', 'CRDO', 'NOW', 'GOOGL', 'TSLA', 'NVDA', 'MU', 'INTC', 'AEHR', 'ZS',
    'AAPL', 'MSFT', 'GOOG', 'AMZN', 'META', 'ADBE', 'CRM', 'ORCL', 'CSCO', 'QCOM', 'TXN',
    'AMAT', 'ADI', 'AMD', 'KLAC', 'LRCX', 'SNPS', 'CDNS', 'ANSS', 'PANW', 'FTNT', 'CRWD',
    'DDOG', 'WDAY', 'TEAM', 'ZM', 'ASML', 'NXPI', 'MCHP', 'ON', 'SWKS', 'QRVO', 'MPWR',
    'AMKR', 'JNJ', 'PFE', 'ABBV', 'LLY', 'MRK', 'BDX', 'MDT', 'REGN', 'GILD', 'BIIB',
    'DXCM', 'IDXX', 'HOLX', 'ABT', 'NKE', 'SBUX', 'TJX', 'ULTA', 'LULU', 'TGT', 'HD',
    'LOW', 'PG', 'KO', 'PEP', 'CL', 'EL', 'MNST', 'HON', 'ITW', 'EMR', 'ETN', 'PH',
    'DOV', 'CMI', 'FAST', 'PWR', 'XOM', 'CVX', 'COP', 'SLB', 'VLO', 'EOG', 'V', 'MA',
    'SPGI', 'MSCI', 'FIS', 'CSX', 'UNP', 'JBHT', 'ADSK', 'PLD', 'EQIX', 'AVB', 'WELL',
    'DHR', 'ECL', 'APD', 'SHW', 'NEM', 'FCX', 'GLW', 'HPQ', 'YELP', 'ETSY', 'EBAY',
    'PDD', 'JD',
    // Qo'shimcha kuzatuv ro'yxati (foydalanuvchi tomonidan berilgan)
    'TTD', 'BE', 'SNDK', 'NBIS', 'RIOT', 'YOU', 'ARM', 'AAP', 'ANET', 'ORLY', 'ITGR',
    'HAL', 'TSM', 'BYD', 'FLNC', 'LNTH', 'DECK', 'TS', 'SEDG', 'TMDX', 'UNH', 'JLL',
    'IWM', 'MCO', 'STRA', 'AVGO', 'PINS', 'ONON', 'INCY', 'IRTC', 'SNOW', 'SHOP', 'ONDS',
    'S', 'OKTA', 'CCJ', 'BRZE', 'IREN', 'DASH', 'ENPH', 'HOOD', 'SMCI', 'DOCU', 'BVN',
    'CRWV', 'HIMS', 'B', 'UBER', 'MSTR', 'IOT', 'DNOW', 'RDDT', 'RKLB', 'TEM', 'SPCX',
    'OKLO', 'A', 'APLD', 'APP', 'CIEN', 'ZETA',
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
      enabled: false,
      period: 20,
      stdDev: 2,
    },
    rsiReversal: {
      enabled: true,
      period: 14,
      oversoldThreshold: 30,
    },
    emaCrossover: {
      enabled: true,
      pairs: [
        { fastPeriod: 9, slowPeriod: 21 },
        { fastPeriod: 9, slowPeriod: 50 },
        { fastPeriod: 21, slowPeriod: 50 },
        { fastPeriod: 50, slowPeriod: 200 },
      ],
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
