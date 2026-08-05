const { Telegraf } = require('telegraf');
const config = require('../config');
const signalStore = require('./signalStore');
const { isMarketOpen } = require('./marketHours');

const TYPE_EMOJI = {
  oversold: '🟢',
  overbought: '🔴',
  golden_cross: '🟢',
  death_cross: '🔴',
  resistance_breakout: '🟢',
  support_breakdown: '🔴',
  volume_spike: '🟠',
  bullish_crossover: '🟢',
  bearish_crossover: '🔴',
  upper_breakout: '🔴',
  lower_breakout: '🟢',
};

function formatSignalMessage(record) {
  const emoji = TYPE_EMOJI[record.type] || '🔔';
  const time = new Date(record.time).toLocaleString('en-US', { timeZone: config.marketTimezone });
  return (
    `${emoji} *${record.symbol}* — ${record.strategy}\n` +
    `${record.message}\n` +
    `Narx: $${Number(record.price).toFixed(2)}\n` +
    `Vaqt: ${time} (NY)`
  );
}

function buildBot() {
  if (!config.telegram.token) {
    throw new Error('TELEGRAM_BOT_TOKEN .env faylida topilmadi');
  }
  const bot = new Telegraf(config.telegram.token);

  bot.command('start', (ctx) => {
    const symbolList = config.symbols.join(', ');
    ctx.reply(
      `📈 *Stock Signal Bot*\n\n` +
        `Kuzatilayotgan aksiyalar: ${symbolList}\n\n` +
        `Strategiyalar: RSI, MA 50/200 Crossover, Support/Resistance Breakout, ` +
        `Volume Spike, MACD, Bollinger Bands.\n\n` +
        `Bozor ochiq bo'lganda (NYSE/NASDAQ, America/New_York) har daqiqada tekshiriladi ` +
        `va signal chiqsa shu yerga yuboriladi.\n\n` +
        `/status — oxirgi signallar va bozor holati`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('status', (ctx) => {
    const open = isMarketOpen();
    const recent = signalStore.getRecentSignals(10);

    let text = `Bozor holati: ${open ? '🟢 ochiq' : '🔴 yopiq'}\n\n`;
    if (recent.length === 0) {
      text += 'Hali signal yo\'q.';
    } else {
      text += `*Oxirgi ${recent.length} ta signal:*\n\n`;
      text += recent
        .map((r) => {
          const emoji = TYPE_EMOJI[r.type] || '🔔';
          const time = new Date(r.time).toLocaleString('en-US', {
            timeZone: config.marketTimezone,
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
          return `${emoji} ${r.symbol} — ${r.strategy} (${time})`;
        })
        .join('\n');
    }
    ctx.reply(text, { parse_mode: 'Markdown' });
  });

  return bot;
}

async function sendSignal(bot, record) {
  if (!config.telegram.chatId) {
    console.warn('TELEGRAM_CHAT_ID sozlanmagan, signal yuborilmadi:', record.symbol, record.strategy);
    return;
  }
  try {
    await bot.telegram.sendMessage(config.telegram.chatId, formatSignalMessage(record), {
      parse_mode: 'Markdown',
    });
  } catch (err) {
    console.error('Telegram xabar yuborishda xato:', err.message);
  }
}

module.exports = { buildBot, sendSignal, formatSignalMessage };
