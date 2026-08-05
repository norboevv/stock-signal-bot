const cron = require('node-cron');
const { isMarketOpen } = require('./marketHours');
const { runCycle } = require('./strategyEngine');
const { sendSignal } = require('./telegramBot');

let running = false; // oldingi tsikl tugamasdan yangisi boshlanmasligi uchun

function startScheduler(bot) {
  console.log('Scheduler ishga tushdi: har daqiqada bozor ochiqligini tekshiradi.');

  cron.schedule('* * * * *', async () => {
    if (!isMarketOpen()) return;
    if (running) {
      console.warn('Oldingi strategiya tsikli hali tugamadi, bu daqiqa o\'tkazib yuborildi.');
      return;
    }

    running = true;
    try {
      const signals = await runCycle();
      for (const signal of signals) {
        console.log(`Signal: ${signal.symbol} — ${signal.strategy} — ${signal.type}`);
        await sendSignal(bot, signal);
      }
    } catch (err) {
      console.error('Strategiya tsiklida xato:', err);
    } finally {
      running = false;
    }
  });
}

module.exports = { startScheduler };
