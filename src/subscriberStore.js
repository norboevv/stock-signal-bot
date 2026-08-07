const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_FILE = path.join(DATA_DIR, 'subscribers.json');

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_FILE)) fs.writeFileSync(STORE_FILE, '[]', 'utf8');
}

function readAll() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  } catch (err) {
    console.error('subscriberStore: fayl o\'qishda xato, bo\'sh ro\'yxat bilan davom etiladi:', err.message);
    return [];
  }
}

function writeAll(list) {
  ensureStore();
  fs.writeFileSync(STORE_FILE, JSON.stringify(list, null, 2), 'utf8');
}

/** chatId — Telegram chat identifikatori (raqam yoki satr sifatida kelishi mumkin, doim string sifatida saqlanadi) */
function addSubscriber(chatId, meta = {}) {
  const id = String(chatId);
  const list = readAll();
  if (list.some((s) => s.chatId === id)) return false;
  list.push({ chatId: id, ...meta, subscribedAt: new Date().toISOString() });
  writeAll(list);
  return true;
}

function removeSubscriber(chatId) {
  const id = String(chatId);
  const list = readAll();
  const next = list.filter((s) => s.chatId !== id);
  if (next.length === list.length) return false;
  writeAll(next);
  return true;
}

function getSubscribers() {
  return readAll();
}

module.exports = { addSubscriber, removeSubscriber, getSubscribers };
