const config = require('./config');
const { buildBot } = require('./src/telegramBot');
const { createApp } = require('./src/webDashboard');
const { startScheduler } = require('./src/scheduler');

function main() {
  const bot = buildBot();

  const app = createApp();
  app.listen(config.server.port, () => {
    console.log(`Dashboard http://localhost:${config.server.port} manzilida ishlayapti.`);
  });

  startScheduler(bot);

  // bot.launch() bot to'xtatilmaguncha resolve bo'lmaydi (Telegraf'ning
  // hujjatlashtirilgan xatti-harakati) — shuning uchun await qilinmaydi,
  // aks holda dashboard va scheduler hech qachon ishga tushmaydi.
  bot.launch()
    .then(() => console.log('Telegram bot to\'xtadi.'))
    .catch((err) => console.error('Telegram bot xatosi:', err));
  console.log('Telegram bot polling rejimida ishga tushdi.');

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

try {
  main();
} catch (err) {
  console.error('Ilova ishga tushmadi:', err);
  process.exit(1);
}
