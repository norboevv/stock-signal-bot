const config = require('../config');
const indicators = require('./indicators');
const { fetchDailyCandles } = require('./dataFetcher');

// Signal turi narxdan qay tomonga harakat kutayotganini bildiradi:
// 1 = ko'tarilish kutiladi, -1 = tushish kutiladi, 0 = yo'nalishsiz (faqat hajm).
// telegramBot.js'dagi emoji ranglari bilan bir xil mantiq (qizil=pasayish, yashil=ko'tarilish).
const TYPE_DIRECTION = {
  oversold: 1,
  overbought: -1,
  golden_cross: 1,
  death_cross: -1,
  resistance_breakout: 1,
  support_breakdown: -1,
  bullish_crossover: 1,
  bearish_crossover: -1,
  upper_breakout: -1,
  lower_breakout: 1,
  oversold_reversal: 1,
  ema_bullish_cross: 1,
};

// Volume Spike va VWAP Cross intraday (1-daqiqalik) ma'lumot talab qiladi, Yahoo esa
// buni faqat oxirgi bir necha kun uchun beradi — shu sabab tarixiy backtest'ga kiritilmagan.
const BACKTEST_CHECKS = [
  { key: 'rsi', fn: (window, cfg) => indicators.checkRsi(window, cfg.rsi) },
  { key: 'maCrossover', fn: (window, cfg) => indicators.checkMaCrossover(window, cfg.maCrossover) },
  { key: 'supportResistance', fn: (window, cfg) => indicators.checkSupportResistance(window, cfg.supportResistance) },
  { key: 'macd', fn: (window, cfg) => indicators.checkMacd(window, cfg.macd) },
  { key: 'bollingerBands', fn: (window, cfg) => indicators.checkBollingerBands(window, cfg.bollingerBands) },
  { key: 'rsiReversal', fn: (window, cfg) => indicators.checkRsiReversal(window, cfg.rsiReversal) },
  { key: 'emaCrossover', fn: (window, cfg) => indicators.checkEmaCrossover(window, cfg.emaCrossover) },
];

const MIN_BARS = 200; // MA200 uchun kamida shuncha bar kerak

function backtestSymbol(dailyCandles, strategiesCfg, forwardWindows) {
  const raw = {}; // strategyName -> { count, windows: { N: {total, wins, sumReturn} } }

  for (let i = MIN_BARS; i < dailyCandles.length; i++) {
    const window = dailyCandles.slice(0, i + 1);

    for (const check of BACKTEST_CHECKS) {
      const cfg = strategiesCfg[check.key];
      if (!cfg || !cfg.enabled) continue;

      let result;
      try {
        result = check.fn(window, strategiesCfg);
      } catch {
        continue;
      }
      if (!result) continue;

      const signals = Array.isArray(result) ? result : [result];
      for (const signal of signals) {
        const direction = TYPE_DIRECTION[signal.type] ?? 0;
        if (!raw[signal.strategy]) raw[signal.strategy] = { count: 0, windows: {} };
        raw[signal.strategy].count += 1;

        for (const N of forwardWindows) {
          const futureIdx = i + N;
          if (futureIdx >= dailyCandles.length) continue;

          const startPrice = dailyCandles[i].close;
          const endPrice = dailyCandles[futureIdx].close;
          const rawReturnPct = ((endPrice - startPrice) / startPrice) * 100;
          const signedReturnPct = direction === 0 ? rawReturnPct : rawReturnPct * direction;

          if (!raw[signal.strategy].windows[N]) {
            raw[signal.strategy].windows[N] = { total: 0, wins: 0, sumReturn: 0 };
          }
          const w = raw[signal.strategy].windows[N];
          w.total += 1;
          if (signedReturnPct > 0) w.wins += 1;
          w.sumReturn += signedReturnPct;
        }
      }
    }
  }

  const summary = {};
  for (const [strategy, data] of Object.entries(raw)) {
    summary[strategy] = { signalCount: data.count, windows: {} };
    for (const [N, w] of Object.entries(data.windows)) {
      summary[strategy].windows[N] = {
        sampleSize: w.total,
        winRatePct: w.total ? Number(((w.wins / w.total) * 100).toFixed(1)) : null,
        avgReturnPct: w.total ? Number((w.sumReturn / w.total).toFixed(2)) : null,
      };
    }
  }
  return summary;
}

async function runBacktest(symbol, opts = {}) {
  const range = opts.range || `${config.backtest.lookbackYears}y`;
  const candles = await fetchDailyCandles(symbol, range);
  if (candles.length < MIN_BARS + 10) {
    throw new Error(`${symbol} uchun yetarli tarixiy ma'lumot yo'q (${candles.length} bar, kamida ${MIN_BARS + 10} kerak)`);
  }
  return backtestSymbol(candles, config.strategies, config.backtest.forwardWindows);
}

module.exports = { runBacktest, backtestSymbol, TYPE_DIRECTION };
