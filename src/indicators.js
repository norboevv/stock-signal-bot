const { RSI, SMA, EMA, MACD, BollingerBands } = require('technicalindicators');

function closesOf(candles) {
  return candles.map((c) => c.close);
}

/** Indikator natijasini (boshida period-1 ta qiymat kam) candle'lar bilan bir uzunlikka keltiradi — boshiga null qo'shib. */
function padLeft(values, totalLength) {
  return new Array(totalLength - values.length).fill(null).concat(values);
}

/**
 * Tekshiriladigan candle indekslari, eng yangisidan boshlab. lookbackMinutes
 * berilmasa — faqat oxirgi candle (kunlik rejim); berilsa — oxirgi candle
 * vaqtidan shuncha daqiqa ichidagi barcha candle'lar (1 daqiqalik rejim:
 * cron orasida sodir bo'lgan kesishni o'tkazib yubormaslik uchun).
 */
function recentIndices(candles, lookbackMinutes) {
  const last = candles.length - 1;
  if (!lookbackMinutes) return [last];
  const cutoff = candles[last].time.getTime() - lookbackMinutes * 60 * 1000;
  const out = [];
  for (let i = last; i >= 0 && candles[i].time.getTime() >= cutoff; i--) out.push(i);
  return out;
}

function timeframeTag(cfg) {
  return cfg.lookbackMinutes ? ' [1m]' : '';
}

/**
 * Joriy daqiqada hali tugamagan (shakllanayotgan) oxirgi 1 daqiqalik
 * candle'ni olib tashlaydi — aks holda RSI/EMA har soniya o'zgarib, kesishish
 * paydo bo'lib yana yo'qolib ("repaint") qolishi mumkin.
 */
function closedCandles(candles, now = Date.now()) {
  if (candles.length === 0) return candles;
  const last = candles[candles.length - 1];
  return now - last.time.getTime() < 60 * 1000 ? candles.slice(0, -1) : candles;
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

/**
 * RSI oversold richalanish (reversal): RSI oversold zonaga (cfg.oversoldThreshold)
 * tushib, so'ng pasayishdan ko'tarilishga o'tgan (trough hosil qilgan) payt.
 * Oddiy "oversold'ga kirdi" signalidan farqli — bu yerda narx hali pasayib
 * turganda emas, aynan yo'nalish o'zgargan (richalanish boshlangan) daqiqada
 * triggerlanadi.
 */
function checkRsiReversal(candles, cfg) {
  if (candles.length < 3) return null;
  const closes = closesOf(candles);
  const rsi = padLeft(RSI.calculate({ values: closes, period: cfg.period }), closes.length);
  const lastIdx = closes.length - 1;
  if (rsi[lastIdx] == null) return null;

  // cfg.lookbackMinutes berilmasa (kunlik rejim) — faqat oxirgi candle.
  // Berilsa (1 daqiqalik rejim) — shu oyna ichidagi oxirgi richalanish,
  // lekin RSI hozir ham trough'dan yuqorida turgan bo'lishi shart.
  for (const i of recentIndices(candles, cfg.lookbackMinutes)) {
    if (i < 2) break;
    const prev2 = rsi[i - 2];
    const prev = rsi[i - 1];
    const curr = rsi[i];
    if (prev2 == null || prev == null || curr == null) continue;

    if (prev < cfg.oversoldThreshold && prev2 > prev && curr > prev && rsi[lastIdx] > prev) {
      return {
        strategy: 'RSI Reversal',
        type: 'oversold_reversal',
        price: closes[lastIdx],
        message: `RSI(${cfg.period}) oversold zonadan (${prev.toFixed(1)}) richalanmoqda — hozir ${rsi[lastIdx].toFixed(1)}${timeframeTag(cfg)}`,
        meta: { rsi: rsi[lastIdx], trough: prev },
      };
    }
  }
  return null;
}

/**
 * EMA bullish crossover: tezkor EMA sekin EMA'ni pastdan tepaga kesib o'tishi.
 * cfg.pairs — {fastPeriod, slowPeriod} juftliklari ro'yxati (masalan 9/21, 9/50,
 * 21/50, 50/200) — bir kunda bir nechta juftlik bir vaqtda crossover berishi
 * mumkin, shuning uchun bitta signal o'rniga massiv qaytaradi.
 */
function checkEmaCrossover(candles, cfg) {
  if (candles.length < 3) return null;
  const closes = closesOf(candles);
  const lastIdx = closes.length - 1;
  const indices = recentIndices(candles, cfg.lookbackMinutes);
  const signals = [];

  for (const pair of cfg.pairs) {
    const fast = padLeft(EMA.calculate({ values: closes, period: pair.fastPeriod }), closes.length);
    const slow = padLeft(EMA.calculate({ values: closes, period: pair.slowPeriod }), closes.length);
    if (fast[lastIdx] == null || slow[lastIdx] == null) continue;
    // Kesishdan keyin EMA hozir ham tezkor > sekin holatida turishi kerak
    if (fast[lastIdx] <= slow[lastIdx]) continue;

    for (const i of indices) {
      if (i < 1) break;
      if (fast[i - 1] == null || slow[i - 1] == null) continue;

      if (fast[i - 1] <= slow[i - 1] && fast[i] > slow[i]) {
        signals.push({
          strategy: `EMA ${pair.fastPeriod}/${pair.slowPeriod} Crossover`,
          type: 'ema_bullish_cross',
          price: closes[lastIdx],
          message: `EMA${pair.fastPeriod} (${fast[lastIdx].toFixed(2)}) EMA${pair.slowPeriod}dan (${slow[lastIdx].toFixed(2)}) pastdan tepaga o'tdi${timeframeTag(cfg)}`,
          meta: { fast: fast[lastIdx], slow: slow[lastIdx], fastPeriod: pair.fastPeriod, slowPeriod: pair.slowPeriod },
        });
        break;
      }
    }
  }

  return signals.length > 0 ? signals : null;
}

/**
 * Narx VWAP'ni pastdan tepaga kesib o'tishi (bullish). VWAP — joriy savdo
 * kunining 1 daqiqalik candle'laridan hisoblanadigan sessiya VWAP'i
 * (typical price × hajm, kumulyativ). Tashqi cron har bir necha daqiqada
 * ishlagani uchun faqat oxirgi candle'ni emas, oxirgi cfg.lookbackMinutes
 * daqiqa ichidagi kesishni qidiramiz (cron orasida sodir bo'lgan kesishni
 * o'tkazib yubormaslik uchun); narx hozir ham VWAP'dan yuqorida bo'lishi
 * shart. Takroriy signalni cooldown to'sadi. Seansning boshidagi
 * cfg.minCandles daqiqa o'tkazib yuboriladi — VWAP u yerda narxga deyarli
 * teng bo'lib, kesishlar shovqin bo'ladi.
 */
function checkVwapCross(intradayCandles, cfg) {
  if (intradayCandles.length < cfg.minCandles + 1) return null;

  const vwap = [];
  let cumPV = 0;
  let cumV = 0;
  for (const c of intradayCandles) {
    cumPV += ((c.high + c.low + c.close) / 3) * c.volume;
    cumV += c.volume;
    vwap.push(cumV > 0 ? cumPV / cumV : null);
  }

  const lastIdx = intradayCandles.length - 1;
  const last = intradayCandles[lastIdx];
  if (vwap[lastIdx] == null || last.close <= vwap[lastIdx]) return null;

  const cutoff = last.time.getTime() - cfg.lookbackMinutes * 60 * 1000;
  for (let i = lastIdx; i >= cfg.minCandles; i--) {
    const curr = intradayCandles[i];
    if (curr.time.getTime() < cutoff) break;
    const prev = intradayCandles[i - 1];
    if (vwap[i] == null || vwap[i - 1] == null) continue;

    if (prev.close <= vwap[i - 1] && curr.close > vwap[i]) {
      return {
        strategy: 'VWAP Cross',
        type: 'vwap_bullish_cross',
        price: last.close,
        message: `Narx (${last.close.toFixed(2)}) VWAP'ni (${vwap[lastIdx].toFixed(2)}) pastdan tepaga kesib o'tdi`,
        meta: { vwap: vwap[lastIdx], crossedAt: curr.time },
      };
    }
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
  checkRsiReversal,
  checkEmaCrossover,
  checkVwapCross,
  closedCandles,
};
