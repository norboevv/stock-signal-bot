const { Telegraf } = require('telegraf');
const config = require('../config');
const signalStore = require('./signalStore');
const subscriberStore = require('./subscriberStore');
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
  oversold_reversal: '🟢',
  ema_bullish_cross: '🟢',
  vwap_bullish_cross: '🟢',
};

const STRATEGY_LABELS = {
  rsi: 'RSI',
  maCrossover: 'MA 50/200 Crossover',
  supportResistance: 'Support/Resistance Breakout',
  volumeSpike: 'Volume Spike',
  macd: 'MACD',
  bollingerBands: 'Bollinger Bands',
  rsiReversal: 'RSI Reversal',
  vwapCross: 'VWAP Cross',
};

function timeframeSuffix(key, cfg) {
  if (key === 'vwapCross') return ' (1m)';
  if (key === 'rsiReversal' || key === 'emaCrossover') return cfg.timeframe === '1m' ? ' (1m)' : ' (kunlik)';
  if (key === 'supportResistance') return ' (kunlik)';
  return '';
}

function enabledStrategyList() {
  return Object.entries(config.strategies)
    .filter(([, cfg]) => cfg.enabled)
    .map(([key, cfg]) => {
      if (key === 'emaCrossover' && Array.isArray(cfg.pairs)) {
        const pairList = cfg.pairs.map((p) => `${p.fastPeriod}/${p.slowPeriod}`).join(', ');
        return `EMA Crossover ${pairList}${timeframeSuffix(key, cfg)}`;
      }
      return (STRATEGY_LABELS[key] || key) + timeframeSuffix(key, cfg);
    })
    .join(', ');
}

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

/** Telegram webhook manzilining yo'l qismi — maxfiy token bilan himoyalangan. */
function getWebhookPath() {
  if (!config.telegram.webhookSecret) {
    throw new Error('TELEGRAM_WEBHOOK_SECRET .env faylida topilmadi');
  }
  return `/telegram-webhook/${config.telegram.webhookSecret}`;
}

/**
 * Botni Telegram serveriga "shu manzilga xabar yubor" deb ro'yxatdan
 * o'tkazadi. Shared hosting'da process doim tirik turmagani uchun
 * long-polling (bot.launch()) o'rniga webhook ishlatiladi — Telegram har
 * safar update kelganda alohida HTTP so'rov yuboradi, process doimiy
 * ishlab turishi shart emas.
 */
async function setupWebhook(bot) {
  if (!config.server.publicUrl) {
    throw new Error('PUBLIC_URL .env faylida topilmadi (masalan https://bot.landmark.uz)');
  }
  const url = `${config.server.publicUrl.replace(/\/+$/, '')}${getWebhookPath()}`;
  await bot.telegram.setWebhook(url);
  console.log('Telegram webhook ro\'yxatdan o\'tkazildi:', url);
}

function buildBot() {
  if (!config.telegram.token) {
    throw new Error('TELEGRAM_BOT_TOKEN .env faylida topilmadi');
  }
  const bot = new Telegraf(config.telegram.token);

  // Telegraf o'zi ushlay olmagan xatolar (masalan reply/sendMessage rad etilishi)
  // butun Node jarayonini qulatib yubormasligi uchun so'nggi himoya qatlami.
  bot.catch((err, ctx) => {
    console.error(`Bot xatosi (${ctx.updateType}):`, err);
  });

  bot.command('start', (ctx) => {
    const isNew = subscriberStore.addSubscriber(ctx.chat.id, {
      username: ctx.from?.username,
      firstName: ctx.from?.first_name,
    });
    const symbolList = config.symbols.join(', ');
    const subscribedLine = isNew
      ? `✅ Siz signal ro'yxatiga qo'shildingiz — endi yangi signal chiqqanda shu yerga yuboriladi.\n\n`
      : `Siz allaqachon signal ro'yxatidasiz.\n\n`;
    ctx.reply(
      `📈 *Stock Signal Bot*\n\n` +
        subscribedLine +
        `Kuzatilayotgan aksiyalar (${config.symbols.length} ta): ${symbolList}\n\n` +
        `Strategiyalar: ${enabledStrategyList()}.\n\n` +
        `Bozor ochiq bo'lganda (NYSE/NASDAQ, Nyu-York vaqti bilan) muntazam tekshiriladi ` +
        `va signal chiqsa shu yerga yuboriladi.\n\n` +
        `/status — oxirgi signallar va bozor holati\n` +
        `/stop — signal olishni to'xtatish`,
      { parse_mode: 'Markdown' }
    ).catch((err) => console.error('/start javobida xato:', err.message));
  });

  bot.command('stop', (ctx) => {
    const removed = subscriberStore.removeSubscriber(ctx.chat.id);
    ctx.reply(
      removed
        ? 'Siz signal ro\'yxatidan chiqarildingiz. Qayta yozilish uchun /start bosing.'
        : 'Siz hozircha signal ro\'yxatida emassiz.'
    ).catch((err) => console.error('/stop javobida xato:', err.message));
  });

  bot.command('status', (ctx) => {
    const open = isMarketOpen();
    const recent = signalStore.getRecentSignals(10);
    const subscriberCount = subscriberStore.getSubscribers().length;

    let text = `Bozor holati: ${open ? '🟢 ochiq' : '🔴 yopiq'}\n`;
    text += `Obunachilar: ${subscriberCount}\n\n`;
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
    ctx.reply(text, { parse_mode: 'Markdown' }).catch((err) => console.error('/status javobida xato:', err.message));
  });

  return bot;
}

/** Signalni /start bosgan barcha obunachilarga yuboradi. Bloklagan/o'chirilgan chat'lar ro'yxatdan avtomatik olib tashlanadi. */
async function sendSignal(bot, record) {
  const subscribers = subscriberStore.getSubscribers();
  if (subscribers.length === 0) {
    console.warn('Obunachi yo\'q, signal hech kimga yuborilmadi:', record.symbol, record.strategy);
    return;
  }

  const text = formatSignalMessage(record);
  for (const { chatId } of subscribers) {
    try {
      await bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } catch (err) {
      const code = err?.response?.error_code;
      if (code === 403) {
        // Foydalanuvchi botni bloklagan yoki chat'ni o'chirgan — ro'yxatdan olib tashlaymiz
        subscriberStore.removeSubscriber(chatId);
        console.warn(`Obunachi ${chatId} botni bloklagan, ro'yxatdan olib tashlandi.`);
      } else {
        console.error(`Telegram xabar yuborishda xato (${chatId}):`, err.message);
      }
    }
  }
}

module.exports = { buildBot, sendSignal, formatSignalMessage, getWebhookPath, setupWebhook };
