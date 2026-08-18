const cron = require('node-cron');
const { isMarketOpen } = require('./marketHours');
const { runCycle } = require('./strategyEngine');
const { sendSignal } = require('./telegramBot');

let running = false; // oldingi tsikl tugamasdan yangisi boshlanmasligi uchun

function startScheduler(bot) {
  console.log('Scheduler ishga tushdi: har 5 daqiqada bozor ochiqligini tekshiradi.');

  // 175+ aksiyani har daqiqada tekshirish shared hosting resurslarini haddan
  // tashqari band qilib, process'ni qayta-qayta qulatib yuborardi. Hozir
  // yoqilgan strategiyalar (RSI Reversal, MACD, EMA Crossover, S/R Breakout)
  // kunlik candle'ga asoslangani uchun 5 daqiqalik interval signal sifatiga
  // sezilarli ta'sir qilmaydi, lekin server yukini ~5x kamaytiradi.
  cron.schedule('*/5 * * * *', async () => {
    if (!isMarketOpen()) return;
    if (running) {
      console.warn('Oldingi strategiya tsikli hali tugamadi, bu safar o\'tkazib yuborildi.');
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
