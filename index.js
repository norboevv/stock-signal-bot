const config = require('./config');
const { buildBot, setupWebhook } = require('./src/telegramBot');
const { createApp } = require('./src/webDashboard');

// So'nggi himoya qatlami: kutilmagan promise rejection yoki xato butun
// ilovani qulatib yubormasligi uchun (masalan noto'g'ri formatlangan
// Telegram xabari avval butun jarayonni o'chirib qo'ygan edi).
process.on('unhandledRejection', (err) => {
  console.error('Ushlanmagan promise xatosi:', err);
});
process.on('uncaughtException', (err) => {
  console.error('Ushlanmagan xato:', err);
});

async function main() {
  const bot = buildBot();

  const app = createApp(bot);
  app.listen(config.server.port, () => {
    console.log(`Dashboard http://localhost:${config.server.port} manzilida ishlayapti.`);
  });

  // Shared hosting (Passenger) process'ni so'rovlar orasida "tirik"
  // ushlab turmaydi, shuning uchun long-polling (bot.launch()) o'rniga
  // webhook ishlatiladi — Telegram har update uchun o'zi HTTP so'rov
  // yuboradi, strategiya tsikli esa tashqi cron orqali /api/run-cycle'ni
  // chaqirib ishga tushiriladi (bu ikkalasi ham bitta HTTP so'rov ichida
  // tugaydigan, Passenger'ning ishlash tarziga mos amallar).
  try {
    await setupWebhook(bot);
  } catch (err) {
    console.error('Webhook ro\'yxatdan o\'tkazishda xato:', err.message);
  }
}

main().catch((err) => {
  console.error('Ilova ishga tushmadi:', err);
  process.exit(1);
});
