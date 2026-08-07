const config = require('./config');
const { buildBot } = require('./src/telegramBot');
const { createApp } = require('./src/webDashboard');
const { startScheduler } = require('./src/scheduler');

// So'nggi himoya qatlami: kutilmagan promise rejection yoki xato butun
// ilovani (bot + dashboard + scheduler) qulatib yubormasligi uchun.
// Masalan bitta noto'g'ri formatlangan Telegram xabari avval butun
// jarayonni o'chirib qo'ygan edi — bu shuni takrorlanmasligini kafolatlaydi.
process.on('unhandledRejection', (err) => {
  console.error('Ushlanmagan promise xatosi:', err);
});
process.on('uncaughtException', (err) => {
  console.error('Ushlanmagan xato:', err);
});

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
