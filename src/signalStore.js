const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_FILE = path.join(DATA_DIR, 'signals.json');
const MAX_RECORDS = 5000; // fayl cheksiz o'smasligi uchun

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_FILE)) fs.writeFileSync(STORE_FILE, '[]', 'utf8');
}

function readAll() {
  ensureStore();
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    // Buzilgan/bo'sh fayl bo'lsa, tarixni yo'qotmaslik uchun xatoni ko'tarish o'rniga bo'sh massiv bilan davom etamiz
    console.error('signalStore: fayl o\'qishda xato, bo\'sh tarix bilan davom etiladi:', err.message);
    return [];
  }
}

function writeAll(records) {
  ensureStore();
  const trimmed = records.slice(-MAX_RECORDS);
  fs.writeFileSync(STORE_FILE, JSON.stringify(trimmed, null, 2), 'utf8');
}

/** signal: { symbol, strategy, type, price, message, meta } */
function appendSignal(signal) {
  const records = readAll();
  const record = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    time: new Date().toISOString(),
    ...signal,
  };
  records.push(record);
  writeAll(records);
  return record;
}

function getRecentSignals(limit = 20) {
  const records = readAll();
  return records.slice(-limit).reverse();
}

function getSignalsBySymbol(symbol, limit = 50) {
  const records = readAll().filter((r) => r.symbol === symbol);
  return records.slice(-limit).reverse();
}

/** symbol+strategy juftligi uchun oxirgi signal vaqti (cooldown tekshiruvi uchun) */
function getLastSignalTime(symbol, strategy) {
  const records = readAll().filter((r) => r.symbol === symbol && r.strategy === strategy);
  if (records.length === 0) return null;
  return new Date(records[records.length - 1].time);
}

module.exports = {
  appendSignal,
  getRecentSignals,
  getSignalsBySymbol,
  getLastSignalTime,
  readAll,
};
