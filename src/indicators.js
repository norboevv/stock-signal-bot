const { RSI, SMA, MACD, BollingerBands } = require('technicalindicators');

function closesOf(candles) {
  return candles.map((c) => c.close);
}

/**
 * RSI(14) oversold/overbought. Har safar signal berilaverishining oldini olish
 * uchun faqat chegaradan "kesib o'tgan" paytda (oldingi bar chegara ichida
 * emas, joriy bar chegarada) triggerlanadi — qolgani cooldown zimmasida.
 */
function checkRsi(dailyCandles, cfg) {
  const closes = closesOf(dailyCandles);
  const values = RSI.calculate({ values: closes, period: cfg.period });
  if (values.length < 2) return null;

  const curr = values[values.length - 1];
  const prev = values[values.length - 2];
  const price = closes[closes.length - 1];

  if (prev >= cfg.oversold && curr < cfg.oversold) {
    return {
      strategy: 'RSI',
      type: 'oversold',
      price,
      message: `RSI(${cfg.period}) ${curr.toFixed(1)} — oversold zonaga kirdi (<${cfg.oversold})`,
      meta: { rsi: curr },
    };
  }
  if (prev <= cfg.overbought && curr > cfg.overbought) {
    return {
      strategy: 'RSI',
      type: 'overbought',
      price,
      message: `RSI(${cfg.period}) ${curr.toFixed(1)} — overbought zonaga kirdi (>${cfg.overbought})`,
      meta: { rsi: curr },
    };
  }
  return null;
}

/** MA 50/200 golden cross / death cross. */
function checkMaCrossover(dailyCandles, cfg) {
  const closes = closesOf(dailyCandles);
  const fast = SMA.calculate({ values: closes, period: cfg.fastPeriod });
  const slow = SMA.calculate({ values: closes, period: cfg.slowPeriod });
  if (fast.length < 2 || slow.length < 2) return null;

  // fast/slow massivlari boshlanish nuqtasi har xil uzunlikda bo'lgani uchun oxiridan solishtiramiz
  const fastCurr = fast[fast.length - 1];
  const fastPrev = fast[fast.length - 2];
  const slowCurr = slow[slow.length - 1];
  const slowPrev = slow[slow.length - 2];
  const price = closes[closes.length - 1];

  if (fastPrev <= slowPrev && fastCurr > slowCurr) {
    return {
      strategy: 'MA Crossover',
      type: 'golden_cross',
      price,
      message: `Golden Cross: MA${cfg.fastPeriod} (${fastCurr.toFixed(2)}) MA${cfg.slowPeriod}dan (${slowCurr.toFixed(2)}) yuqoriga chiqdi`,
      meta: { fast: fastCurr, slow: slowCurr },
    };
  }
  if (fastPrev >= slowPrev && fastCurr < slowCurr) {
    return {
      strategy: 'MA Crossover',
      type: 'death_cross',
      price,
      message: `Death Cross: MA${cfg.fastPeriod} (${fastCurr.toFixed(2)}) MA${cfg.slowPeriod}dan (${slowCurr.toFixed(2)}) pastga tushdi`,
      meta: { fast: fastCurr, slow: slowCurr },
    };
  }
  return null;
}

/** 20 kunlik support/resistance breakout. */
function checkSupportResistance(dailyCandles, cfg) {
  if (dailyCandles.length < cfg.lookbackDays + 1) return null;

  const lookback = dailyCandles.slice(-(cfg.lookbackDays + 1), -1); // bugungisiz oxirgi N kun
  const today = dailyCandles[dailyCandles.length - 1];

  const resistance = Math.max(...lookback.map((c) => c.high));
  const support = Math.min(...lookback.map((c) => c.low));

  if (today.close > resistance) {
    return {
      strategy: 'Support/Resistance',
      type: 'resistance_breakout',
      price: today.close,
      message: `Resistance breakout: narx ${today.close.toFixed(2)}, ${cfg.lookbackDays} kunlik resistance ${resistance.toFixed(2)}`,
      meta: { resistance, support },
    };
  }
  if (today.close < support) {
    return {
      strategy: 'Support/Resistance',
      type: 'support_breakdown',
      price: today.close,
      message: `Support breakdown: narx ${today.close.toFixed(2)}, ${cfg.lookbackDays} kunlik support ${support.toFixed(2)}`,
      meta: { resistance, support },
    };
  }
  return null;
}

/**
 * Oxirgi 15 daqiqalik hajm 20-kunlik o'rtacha "15 daqiqalik" hajmdan necha
 * marta oshganini tekshiradi. 20-kunlik o'rtacha kunlik hajm savdo kunidagi
 * 15-daqiqalik oynalar soniga (6.5 soat / 15 daq = 26) bo'linadi.
 */
function checkVolumeSpike(intradayCandles, dailyCandles, cfg) {
  if (dailyCandles.length < cfg.lookbackDays + 1) return null;
  if (intradayCandles.length === 0) return null;

  const lookback = dailyCandles.slice(-(cfg.lookbackDays + 1), -1);
  const avgDailyVolume = lookback.reduce((s, c) => s + c.volume, 0) / lookback.length;
  const windowsPerDay = (6.5 * 60) / cfg.windowMinutes;
  const expected15min = avgDailyVolume / windowsPerDay;

  const now = intradayCandles[intradayCandles.length - 1].time;
  const cutoff = new Date(now.getTime() - cfg.windowMinutes * 60 * 1000);
  const recent = intradayCandles.filter((c) => c.time >= cutoff);
  const recentVolume = recent.reduce((s, c) => s + c.volume, 0);

  if (expected15min > 0 && recentVolume > expected15min * cfg.multiplier) {
    const price = intradayCandles[intradayCandles.length - 1].close;
    return {
      strategy: 'Volume Spike',
      type: 'volume_spike',
      price,
      message: `Hajm portlashi: oxirgi ${cfg.windowMinutes} daqiqada ${recentVolume.toLocaleString()} (kutilgan ~${Math.round(expected15min).toLocaleString()}, ${(recentVolume / expected15min).toFixed(1)}x)`,
      meta: { recentVolume, expected15min },
    };
  }
  return null;
}

/** MACD signal-line crossover (bullish/bearish). */
function checkMacd(dailyCandles, cfg) {
  const closes = closesOf(dailyCandles);
  const values = MACD.calculate({
    values: closes,
    fastPeriod: cfg.fastPeriod,
    slowPeriod: cfg.slowPeriod,
    signalPeriod: cfg.signalPeriod,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  if (values.length < 2) return null;

  const curr = values[values.length - 1];
  const prev = values[values.length - 2];
  if (curr.MACD == null || curr.signal == null || prev.MACD == null || prev.signal == null) return null;

  const price = closes[closes.length - 1];
  const currDiff = curr.MACD - curr.signal;
  const prevDiff = prev.MACD - prev.signal;

  if (prevDiff <= 0 && currDiff > 0) {
    return {
      strategy: 'MACD',
      type: 'bullish_crossover',
      price,
      message: `MACD bullish crossover: MACD ${curr.MACD.toFixed(3)} > Signal ${curr.signal.toFixed(3)}`,
      meta: { macd: curr.MACD, signal: curr.signal, histogram: curr.histogram },
    };
  }
  if (prevDiff >= 0 && currDiff < 0) {
    return {
      strategy: 'MACD',
      type: 'bearish_crossover',
      price,
      message: `MACD bearish crossover: MACD ${curr.MACD.toFixed(3)} < Signal ${curr.signal.toFixed(3)}`,
      meta: { macd: curr.MACD, signal: curr.signal, histogram: curr.histogram },
    };
  }
  return null;
}

/** Bollinger Bands breakout: narx yuqori/quyi bandni kesib o'tishi. */
function checkBollingerBands(dailyCandles, cfg) {
  const closes = closesOf(dailyCandles);
  const values = BollingerBands.calculate({ values: closes, period: cfg.period, stdDev: cfg.stdDev });
  if (values.length < 2) return null;

  const curr = values[values.length - 1];
  const prev = values[values.length - 2];
  const priceIdx = closes.length - 1;
  const priceCurr = closes[priceIdx];
  const pricePrev = closes[priceIdx - 1];

  if (pricePrev <= prev.upper && priceCurr > curr.upper) {
    return {
      strategy: 'Bollinger Bands',
      type: 'upper_breakout',
      price: priceCurr,
      message: `Bollinger Bands upper breakout: narx ${priceCurr.toFixed(2)} > yuqori band ${curr.upper.toFixed(2)}`,
      meta: { upper: curr.upper, middle: curr.middle, lower: curr.lower },
    };
  }
  if (pricePrev >= prev.lower && priceCurr < curr.lower) {
    return {
      strategy: 'Bollinger Bands',
      type: 'lower_breakout',
      price: priceCurr,
      message: `Bollinger Bands lower breakout: narx ${priceCurr.toFixed(2)} < quyi band ${curr.lower.toFixed(2)}`,
      meta: { upper: curr.upper, middle: curr.middle, lower: curr.lower },
    };
  }
  return null;
}

module.exports = {
  checkRsi,
  checkMaCrossover,
  checkSupportResistance,
  checkVolumeSpike,
  checkMacd,
  checkBollingerBands,
};
