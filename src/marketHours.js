const MARKET_TZ = 'America/New_York';

function getNyParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: MARKET_TZ,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = fmt.formatToParts(date).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  return {
    weekday: parts.weekday,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

// NYSE/NASDAQ standart savdo vaqti: Dush-Juma, 09:30-16:00 America/New_York.
// Intl.DateTimeFormat 'America/New_York' zonasi DST'ni avtomatik hisobga oladi,
// shuning uchun qo'lda offset boshqarish kerak emas. Rasmiy bayram kunlari
// hisobga olinmagan — bozor ochiq deb ko'rsatilishi mumkin, lekin real
// savdo yo'qligi sababli signal shart-sharoitlari (masalan volume) baribir
// signal chiqarmaydi.
function isMarketOpen(date = new Date()) {
  const { weekday, hour, minute } = getNyParts(date);
  if (weekday === 'Sat' || weekday === 'Sun') return false;

  const minutesNow = hour * 60 + minute;
  const open = 9 * 60 + 30;
  const close = 16 * 60;
  return minutesNow >= open && minutesNow < close;
}

module.exports = { isMarketOpen, getNyParts, MARKET_TZ };
