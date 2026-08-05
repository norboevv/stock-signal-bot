#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { runBacktest } = require('../src/backtester');

const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'backtest-results.json');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const argSymbols = process.argv.slice(2).map((s) => s.toUpperCase());
  const symbols = argSymbols.length > 0 ? argSymbols : config.symbols;

  console.log(`Backtest boshlandi: ${symbols.join(', ')} (${config.backtest.lookbackYears} yillik tarix)\n`);

  const results = {};
  for (const symbol of symbols) {
    process.stdout.write(`  ${symbol}... `);
    try {
      const summary = await runBacktest(symbol);
      results[symbol] = summary;
      console.log('OK');

      for (const [strategy, data] of Object.entries(summary)) {
        console.log(`    ${strategy}: ${data.signalCount} ta signal`);
        for (const [N, w] of Object.entries(data.windows)) {
          if (w.sampleSize === 0) continue;
          console.log(
            `      +${N} kun: win-rate ${w.winRatePct}% (${w.sampleSize} ta namuna), o'rtacha return ${w.avgReturnPct}%`
          );
        }
      }
    } catch (err) {
      console.log(`XATO: ${err.message}`);
    }
    await sleep(500); // Yahoo Finance'ni ketma-ket so'rovlar bilan bosib qolmaslik
  }

  const dataDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2),
    'utf8'
  );
  console.log(`\nNatijalar saqlandi: ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error('Backtest xato bilan to\'xtadi:', err);
  process.exit(1);
});
