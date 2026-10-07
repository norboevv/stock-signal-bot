# stock-signal-bot

AQSH aksiyalarini (`config.js`dagi `symbols` ro'yxati — hozir 21 ta: AEHR, ALAB, ANET, APLD, APP, AVGO, CBRS, CRDO, CIEN, CRWD, HIMS, IREN, MRVL, MSTR, MU, NVDA, NOW, SNDK, SPCX, ZETA, RDDT) real-time
kuzatib, texnik indikatorlar signal berganda Telegram orqali xabar yuboradigan bot. Signal
tarixi va backtest natijalarini ko'rsatuvchi web dashboard bilan birga keladi.

## Strategiyalar

| Strategiya | Tavsif |
|---|---|
| RSI(14) | Oversold (<30) / overbought (>70) |
| MA 50/200 Crossover | Golden cross / death cross |
| Support/Resistance | 20 kunlik breakout (**kunlik** candle'lar) |
| Volume Spike | Oxirgi 15 daqiqadagi hajm 20-kunlik o'rtachadan 2x oshsa |
| MACD | Signal-line crossover (12/26/9) |
| Bollinger Bands | Narx yuqori/quyi banddan chiqib ketishi (20, 2σ) |
| RSI Reversal | RSI oversold zonadan (<30) yuqoriga richalanganda. Hozir **1 daqiqalik** candle'lar (`timeframe: '1m'`) |
| EMA Crossover | EMA 9 EMA 21'ni pastdan tepaga kesib o'tganda (faqat bullish; `pairs` ro'yxatiga boshqa juftliklar qo'shish mumkin). Hozir **1 daqiqalik** candle'lar |
| VWAP Cross | Narx sessiya VWAP'ini (1 daqiqalik candle'lardan) pastdan tepaga kesib o'tganda |

`config.js`dagi `strategies` bo'limida har birini `enabled: true/false` bilan yoqish/o'chirish mumkin.
Hozir **yoqilgan**: Support/Resistance, EMA Crossover (9/21), VWAP Cross, RSI Reversal.
Qolganlari (RSI, MA 50/200, Volume Spike, MACD, Bollinger Bands) kodda bor, lekin `enabled: false`.
**Timeframe:** Support/Resistance kunlik candle'larda; RSI Reversal, EMA Crossover va VWAP Cross
1 daqiqalik (faqat **tugagan**, ya'ni yopilgan candle'lar) bo'yicha hisoblanadi. 1 daqiqalik
signal bir daqiqa "yashagani" uchun, cron orasida sodir bo'lganlarni o'tkazib yubormaslik
maqsadida oxirgi `lookbackMinutes` (10) daqiqa ichidagi hodisaga qaraladi va indikator hozir ham
signal holatida turishi shart. Takroriy xabarni 30 daqiqalik cooldown to'sadi.
`lookbackMinutes` cron intervalidan kamida 2 baravar katta bo'lsin.
`timeframe`ni `'1d'` (yoki olib tashlab) kunlik rejimga qaytarish mumkin.

Intraday ma'lumotga tayanganlari (VWAP Cross, Volume Spike, 1m rejimdagi RSI Reversal va
EMA Crossover) backtest'ga kirmaydi.

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
- **TELEGRAM_WEBHOOK_SECRET** va **CRON_SECRET** — tasodifiy satrlar, generatsiya qilish:
  `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`
- **PUBLIC_URL** — ilovaning tashqi HTTPS manzili (masalan `https://bot.example.com`).
  Lokal test uchun bu majburiy emas (webhook ro'yxatdan o'tkazish xatosi bilan
  o'tkazib yuboriladi, qolgan hammasi ishlayveradi).
- **DASHBOARD_PASSWORD** — web dashboard'ga kirish uchun parol (Basic Auth). Standart
  qiymatni albatta o'zgartiring.
- **PORT** — lokal ishga tushirishda dashboard porti (standart 3000). aHost.uz'da bu
  Passenger tomonidan avtomatik beriladi, o'zingiz sozlashingiz shart emas.

Ishga tushirish:

```bash
npm start
```

### Arxitektura — nega webhook + tashqi cron?

Shared hosting'da (cPanel + Phusion Passenger) Node ilovasi **so'rovlar orasida doim
tirik turmaydi** — Passenger uni resurs tejash uchun tez-tez o'chirib-yoqib turadi.
Shuning uchun bu loyiha an'anaviy "doim fonda ishlaydigan bot" o'rniga so'rov-asosli
arxitekturadan foydalanadi:

- **Telegram bot** — long-polling (`bot.launch()`) o'rniga **webhook** ishlatadi:
  Telegram har yangi xabar kelganda o'zi `/telegram-webhook/<TELEGRAM_WEBHOOK_SECRET>`
  manziliga POST so'rov yuboradi. `/start`, `/status`, `/stop` shu so'rov ichida,
  bir zumda ishlanadi — process doimiy ishlab turishi shart emas.
- **Strategiya tsikli** — ichki `node-cron` o'rniga **tashqi cPanel Cron Job**
  `/api/run-cycle?token=<CRON_SECRET>` manziliga vaqti-vaqti bilan (masalan har 5
  daqiqada) so'rov yuboradi. Shu bitta HTTP so'rov ichida barcha aksiyalar
  tekshiriladi va topilgan signallar yuboriladi, so'ng javob qaytariladi.

Ikkalasi ham Passenger'ning "so'rov kelsa ishga tush, javob ber, kerak bo'lsa
o'chib qol" tamoyiliga mos — process doimiy tirik turishiga tayanmaydi.

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
   fayldagi qiymatlarni qo'shing: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`,
   `CRON_SECRET`, `PUBLIC_URL` (masalan `https://bot.landmark.uz`), `DASHBOARD_PASSWORD`.
   `PORT`ni qo'lda qo'shmang — Passenger buni o'zi beradi. Qiymatlarda `!`, `$`, `` ` ``,
   `"`, boshqa maxsus belgilardan foydalanmang — cPanel'ning ba'zi versiyalarida
   ular env var export skriptini buzadi.
6. **Restart** tugmasini bosing. Ilova ishga tushgach, `PUBLIC_URL` manzilida
   dashboard ochiladi va bot avtomatik ravishda Telegram'ga webhook manzilini
   ("shu yerga xabar yubor") ro'yxatdan o'tkazadi.
7. **cPanel Cron Job yarating** (Tools → Cron Jobs) — strategiya tsiklini muntazam
   ishga tushirish uchun (masalan har 5 daqiqada, `*/5 * * * *`):
   ```bash
   curl -s -o /dev/null "https://bot.landmark.uz/api/run-cycle?token=<CRON_SECRET>"
   ```
   Bu bir yo'la ikkita vazifani bajaradi: strategiyalarni tekshiradi **va** Passenger'ni
   ilovani o'chirib qo'yishidan saqlab, doim "uyg'oq" ushlab turadi.
8. Tekshirish: Telegram'da botga `/start` yozing — javob va obuna tasdig'i kelishi kerak.
   Oila a'zolari ham xuddi shu botga `/start` bosishi kifoya — hammasi avtomatik signal
   oluvchilar ro'yxatiga qo'shiladi. `/status` — bozor holati va obunachilar soni.

**Muhim:** hostingning haqiqiy PUBLIC_URL manziliga `curl` orqali qo'lda so'rov yuborib
ko'rish mumkin (`/api/run-cycle?token=...`) — bu strategiya tsiklini darhol, cron
kutmasdan ishga tushiradi, sozlamalarni tekshirish uchun qulay.

## Fayl strukturasi

```
config.js              — symbol va threshold sozlamalari
src/dataFetcher.js      — Yahoo Finance'dan daily + intraday candle
src/indicators.js       — RSI, MA crossover, S/R breakout, volume spike, MACD, Bollinger Bands
src/strategyEngine.js   — barcha strategiyalarni birlashtiradi + cooldown
src/marketHours.js      — bozor ochiq/yopiqligini tekshiradi
src/signalStore.js      — signal tarixini data/signals.json'ga saqlaydi
src/backtester.js       — tarixiy ma'lumot bo'yicha strategiya aniqligini hisoblaydi
src/webDashboard.js     — Express dashboard + /telegram-webhook + /api/run-cycle
src/telegramBot.js      — Telegraf setup, /start, /status, signal xabarlari, webhook
scripts/backtest.js     — backtest'ni CLI orqali ishga tushirish
public/index.html       — dashboard frontend
index.js                — entry point (bot + dashboard, webhook ro'yxatdan o'tkazish)
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
