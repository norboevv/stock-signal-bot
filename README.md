# stock-signal-bot

AQSH aksiyalarini (AKAM, MRVL, CRDO, NOW, GOOGL, TSLA, NVDA, MU, INTC, AEHR, ZS) real-time
kuzatib, texnik indikatorlar signal berganda Telegram orqali xabar yuboradigan bot. Signal
tarixi va backtest natijalarini ko'rsatuvchi web dashboard bilan birga keladi.

## Strategiyalar

| Strategiya | Tavsif |
|---|---|
| RSI(14) | Oversold (<30) / overbought (>70) |
| MA 50/200 Crossover | Golden cross / death cross |
| Support/Resistance | 20 kunlik breakout |
| Volume Spike | Oxirgi 15 daqiqadagi hajm 20-kunlik o'rtachadan 2x oshsa |
| MACD | Signal-line crossover (12/26/9) |
| Bollinger Bands | Narx yuqori/quyi banddan chiqib ketishi (20, 2σ) |

Har bir symbol+strategiya juftligi uchun 30 daqiqalik cooldown bor — bitta signal ketma-ket
spam qilib yuborilmaydi.

## 1. Lokal sozlash

```bash
npm install
cp .env.example .env
```

`.env` faylini to'ldiring:

- **TELEGRAM_BOT_TOKEN** — Telegram'da `@BotFather` ga yozib `/newbot` bilan yangi bot
  yarating, u bergan tokenni shu yerga qo'ying.
- **TELEGRAM_CHAT_ID** — signal yuboriladigan chat ID. Shaxsiy testda o'zingizga yuborish
  uchun `@userinfobot` orqali o'z Telegram user ID'ingizni oling. Guruh/kanal uchun botni
  o'sha joyga admin qilib qo'shing va guruh ID'sini oling (odatda `-100...` bilan boshlanadi).
- **DASHBOARD_PASSWORD** — web dashboard'ga kirish uchun parol (Basic Auth). Standart
  qiymatni albatta o'zgartiring.
- **PORT** — lokal ishga tushirishda dashboard porti (standart 3000). aHost.uz'da bu
  Passenger tomonidan avtomatik beriladi, o'zingiz sozlashingiz shart emas.

Ishga tushirish:

```bash
npm start
```

Bu bitta process ichida uchtasini birdan ishga tushiradi:
- Telegram bot (polling rejimida, `/start` va `/status` komandalari)
- Web dashboard (`http://localhost:3000`)
- Scheduler — har daqiqada, faqat NYSE/NASDAQ ochiq vaqtida (`America/New_York`, DST
  avtomatik) barcha strategiyalarni tekshiradi

## 2. Backtesting

Har bir strategiya o'tmishda qanchalik aniq ishlaganini tekshirish uchun:

```bash
npm run backtest              # config.js'dagi barcha symbol'lar, 2 yillik tarix
npm run backtest NVDA TSLA    # faqat tanlangan symbol'lar
```

Har bir signaldan keyingi 5/10/20 kunlik forward return va win-rate hisoblanadi, natija
`data/backtest-results.json` ga saqlanadi va dashboard'da ko'rinadi. **Volume Spike**
strategiyasi backtest'ga kiritilmagan — Yahoo Finance 1-daqiqalik tarixiy ma'lumotni faqat
so'nggi bir necha kun uchun beradi, uzoq muddatli backtest uchun yetarli emas.

Backtest natijalari **tavsiya emas**, faqat tarixiy statistika — kelajakdagi natijani
kafolatlamaydi.

## 3. Web dashboard

`http://localhost:3000` (yoki deploy qilingan domen) — Basic Auth orqali himoyalangan
(`DASHBOARD_PASSWORD`). Ikkita bo'lim bor:
- **Signal tarixi** — barcha yuborilgan signallar, symbol bo'yicha filtrlash mumkin
- **Backtest natijalari** — oxirgi `npm run backtest` natijasi

## 4. aHost.uz cPanel'ga deploy qilish

1. Loyihani serverga yuklang (Git orqali yoki cPanel File Manager'da zip yuklab
   yeching) — masalan `~/stock-signal-bot` papkasiga.
2. cPanel'da **Setup Node.js App** bo'limiga kiring.
3. **Create Application**:
   - *Node.js version*: 18 yoki undan yuqori
   - *Application mode*: Production
   - *Application root*: `stock-signal-bot` (yuklagan papkangiz)
   - *Application startup file*: `index.js`
4. Ilova yaratilgandan so'ng, cPanel sizga "Enter to the virtual environment" buyrug'ini
   beradi — shu orqali terminalda:
   ```bash
   source /home/USERNAME/nodevenv/stock-signal-bot/18/bin/activate
   cd ~/stock-signal-bot
   npm install
   ```
5. cPanel Node.js App sahifasidagi **Environment Variables** bo'limiga `.env`
   fayldagi barcha qiymatlarni qo'shing (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`,
   `DASHBOARD_PASSWORD`). `PORT`ni qo'lda qo'shmang — Passenger buni o'zi beradi.
6. **Restart** tugmasini bosing. Ilova ishga tushgach, cPanel ko'rsatgan domen/subdomen
   orqali dashboard ochiladi, bot esa Telegram'da polling rejimida ishlay boshlaydi.
7. Tekshirish: Telegram'da botga `/start` yozing, keyin bozor ochiq vaqtida `/status`
   bilan signal tarixini kuzating.

**Eslatma:** cPanel Passenger jarayonni doim tirik ushlab turadi (crash bo'lsa qayta
ishga tushiradi), shuning uchun alohida process manager (pm2 va h.k.) kerak emas.

## Fayl strukturasi

```
config.js              — symbol va threshold sozlamalari
src/dataFetcher.js      — Yahoo Finance'dan daily + intraday candle
src/indicators.js       — RSI, MA crossover, S/R breakout, volume spike, MACD, Bollinger Bands
src/strategyEngine.js   — barcha strategiyalarni birlashtiradi + cooldown
src/marketHours.js      — bozor ochiq/yopiqligini tekshiradi
src/signalStore.js      — signal tarixini data/signals.json'ga saqlaydi
src/backtester.js       — tarixiy ma'lumot bo'yicha strategiya aniqligini hisoblaydi
src/webDashboard.js     — Express dashboard (signal tarixi + backtest natijalari)
src/telegramBot.js      — Telegraf setup, /start, /status, signal xabarlari
src/scheduler.js        — node-cron bilan har daqiqalik tsikl
scripts/backtest.js     — backtest'ni CLI orqali ishga tushirish
public/index.html       — dashboard frontend
index.js                — entry point (bot + dashboard + scheduler birga)
```

## Ma'lum cheklovlar

- Yahoo Finance norasmiy chart API — key kerak emas, lekin rasmiy SLA yo'q, vaqti-vaqti
  bilan rate limit yoki formatga o'zgarish bo'lishi mumkin.
- Rasmiy bozor bayramlari (Thanksgiving, Christmas va h.k.) `marketHours.js`da hisobga
  olinmagan — bozor "ochiq" deb ko'rsatiladi, lekin real savdo yo'qligi sababli
  Yahoo'dan kelayotgan ma'lumot o'zgarmaydi va signal shart-sharoitlari odatda
  bajarilmaydi.
- `data/signals.json` va `data/backtest-results.json` oddiy JSON fayllar — juda katta
  hajmda (minglab signal) ishlatilsa, alohida DB'ga o'tish tavsiya etiladi.
