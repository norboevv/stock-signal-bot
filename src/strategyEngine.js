const config = require('../config');
const indicators = require('./indicators');
const { fetchDailyCandles, fetchIntradayCandles } = require('./dataFetcher');
const signalStore = require('./signalStore');

const STRATEGY_CHECKS = [
  { key: 'rsi', fn: (daily, intraday, cfg) => indicators.checkRsi(daily, cfg) },
  { key: 'maCrossover', fn: (daily, intraday, cfg) => indicators.checkMaCrossover(daily, cfg) },
  { key: 'supportResistance', fn: (daily, intraday, cfg) => indicators.checkSupportResistance(daily, cfg) },
  { key: 'volumeSpike', fn: (daily, intraday, cfg) => indicators.checkVolumeSpike(intraday, daily, cfg) },
  { key: 'macd', fn: (daily, intraday, cfg) => indicators.checkMacd(daily, cfg) },
  { key: 'bollingerBands', fn: (daily, intraday, cfg) => indicators.checkBollingerBands(daily, cfg) },
  { key: 'rsiReversal', fn: (daily, intraday, cfg) => indicators.checkRsiReversal(daily, cfg) },
  { key: 'emaCrossover', fn: (daily, intraday, cfg) => indicators.checkEmaCrossover(daily, cfg) },
];

// Daily candle'lar daqiqada bir necha marta o'zgarmaydi — Yahoo'ga har daqiqada
// qayta so'rov yubormaslik uchun qisqa TTL bilan keshlanadi. Intraday har doim yangilanadi.
const dailyCache = new Map(); // symbol -> { data, fetchedAt }
const DAILY_CACHE_TTL_MS = 5 * 60 * 1000;

async function getDailyCandles(symbol) {
  const cached = dailyCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < DAILY_CACHE_TTL_MS) {
    return cached.data;
  }
  const data = await fetchDailyCandles(symbol, '1y');
  dailyCache.set(symbol, { data, fetchedAt: Date.now() });
  return data;
}

function buildCooldownMap() {
  const all = signalStore.readAll();
  const map = new Map();
  for (const r of all) {
    const key = `${r.symbol}|${r.strategy}`;
    const t = new Date(r.time);
    const existing = map.get(key);
    if (!existing || t > existing) map.set(key, t);
  }
  return map;
}

function isOnCooldown(map, symbol, strategyName, cooldownMinutes) {
  const last = map.get(`${symbol}|${strategyName}`);
  if (!last) return false;
  return Date.now() - last.getTime() < cooldownMinutes * 60 * 1000;
}

async function runForSymbol(symbol, cooldownMap) {
  const newSignals = [];

  let daily;
  try {
    daily = await getDailyCandles(symbol);
  } catch (err) {
    console.error(`[${symbol}] daily candle olishda xato:`, err.message);
    return newSignals;
  }

  let intraday = [];
  try {
    intraday = await fetchIntradayCandles(symbol);
  } catch (err) {
    console.error(`[${symbol}] intraday candle olishda xato:`, err.message);
  }

  for (const check of STRATEGY_CHECKS) {
    const cfg = config.strategies[check.key];
    if (!cfg || !cfg.enabled) continue;

    let result;
    try {
      result = check.fn(daily, intraday, cfg);
    } catch (err) {
      console.error(`[${symbol}] ${check.key} strategiyasida xato:`, err.message);
      continue;
    }
    if (!result) continue;

    // Ba'zi strategiyalar (masalan bir nechta EMA juftligi) bir vaqtda
    // birdan ortiq signal berishi mumkin — massiv yoki bitta obyekt bo'lishi mumkin.
    const results = Array.isArray(result) ? result : [result];
    for (const r of results) {
      if (isOnCooldown(cooldownMap, symbol, r.strategy, config.cooldownMinutes)) continue;

      const record = signalStore.appendSignal({ symbol, ...r });
      cooldownMap.set(`${symbol}|${r.strategy}`, new Date(record.time));
      newSignals.push(record);
    }
  }

  return newSignals;
}

/** Barcha symbol'lar bo'yicha bir tsikl: yangi (cooldown'da bo'lmagan) signallar ro'yxatini qaytaradi. */
async function runCycle() {
  const cooldownMap = buildCooldownMap();
  const allNewSignals = [];

  // Yahoo Finance'ni bir vaqtda ko'p so'rov bilan bosib qolmaslik uchun ketma-ket ishlaymiz
  for (const symbol of config.symbols) {
    const signals = await runForSymbol(symbol, cooldownMap);
    allNewSignals.push(...signals);
  }

  return allNewSignals;
}

module.exports = { runCycle };
