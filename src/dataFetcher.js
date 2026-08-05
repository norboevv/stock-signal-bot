const axios = require('axios');

const BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

const client = axios.create({
  timeout: 10000,
  headers: {
    // Yahoo'ning norasmiy chart API'si User-Agent'siz so'rovlarni ba'zan rad etadi.
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  },
});

function parseChartResponse(json) {
  const result = json?.chart?.result?.[0];
  if (!result) {
    const err = json?.chart?.error;
    throw new Error(`Yahoo Finance javobi bo'sh: ${err ? JSON.stringify(err) : 'unknown'}`);
  }

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const { open = [], high = [], low = [], close = [], volume = [] } = quote;

  const candles = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (close[i] == null) continue; // bozor yopiq bo'lgan barlar uchun null keladi
    candles.push({
      time: new Date(timestamps[i] * 1000),
      open: open[i],
      high: high[i],
      low: low[i],
      close: close[i],
      volume: volume[i] ?? 0,
    });
  }
  return candles;
}

async function fetchChart(symbol, { interval, range }) {
  const url = `${BASE_URL}/${encodeURIComponent(symbol)}`;
  const { data } = await client.get(url, {
    params: { interval, range, includePrePost: false },
  });
  return parseChartResponse(data);
}

/** Kunlik candle'lar — indikatorlar (RSI, MA, MACD, BB) va backtesting uchun. */
async function fetchDailyCandles(symbol, range = '2y') {
  return fetchChart(symbol, { interval: '1d', range });
}

/** Joriy savdo kunidagi 1-daqiqalik candle'lar — volume spike va real-time narx uchun. */
async function fetchIntradayCandles(symbol) {
  return fetchChart(symbol, { interval: '1m', range: '1d' });
}

module.exports = { fetchDailyCandles, fetchIntradayCandles, fetchChart };
