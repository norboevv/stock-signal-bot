const config = require('./config');
const { buildBot } = require('./src/telegramBot');
const { createApp } = require('./src/webDashboard');
const { startScheduler } = require('./src/scheduler');

async function main() {
  const bot = buildBot();
  await bot.launch();
  console.log('Telegram bot polling rejimida ishga tushdi.');

  const app = createApp();
  app.listen(config.server.port, () => {
    console.log(`Dashboard http://localhost:${config.server.port} manzilida ishlayapti.`);
  });

  startScheduler(bot);

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch((err) => {
  console.error('Ilova ishga tushmadi:', err);
  process.exit(1);
});
