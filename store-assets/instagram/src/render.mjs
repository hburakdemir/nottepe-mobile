// Instagram "artık yayında" görsellerini d*.html şablonlarından PNG olarak üretir.
//   NODE_PATH=/opt/node22/lib/node_modules node store-assets/instagram/src/render.mjs [d1 d3 ...]
// Argüman verilmezse beş tasarımın hepsi, her biri gönderi (4:5) + hikâye (9:16) olarak basılır.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';

// require() NODE_PATH'i dikkate alır, ESM import'u almaz — global kurulum için.
const { chromium } = createRequire(import.meta.url)('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '..');

const DESIGNS = [
  ['d1', 'd1-filigran.html', '1_filigran'],
  ['d2', 'd2-editoryal.html', '2_editoryal'],
  ['d3', 'd3-bento.html', '3_bento'],
  ['d4', 'd4-brutal.html', '4_brutal'],
  ['d5', 'd5-aurora.html', '5_aurora'],
];
const SIZES = { post: [1080, 1350], story: [1080, 1920] };

// file:// üzerinden CSS mask-image ve fontlar CORS'a takılıyor; depo kökünü küçük bir
// HTTP sunucusuyla servis et (şablonlar ../../../assets/icon.png'ye de uzanıyor).
const root = path.resolve(here, '../../..');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/${path.relative(root, here)}/`;

const only = process.argv.slice(2);
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
try {
  for (const [id, file, slug] of DESIGNS) {
    if (only.length && !only.includes(id)) continue;
    for (const [f, [w, h]] of Object.entries(SIZES)) {
      const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      page.on('console', (m) => m.type() === 'error' && console.warn(`  [${id}/${f}]`, m.text()));
      page.on('requestfailed', (r) => console.warn(`  [${id}/${f}] yüklenemedi:`, r.url()));
      await page.goto(`${base}${file}?f=${f}`, { waitUntil: 'networkidle' });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.images].map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r)))),
        );
      });
      const out = `${slug}_${f}_${w}x${h}.png`;
      await page.locator('.canvas').screenshot({ path: path.join(outDir, out) });
      await page.close();
      console.log('✓', out);
    }
  }
} finally {
  await browser.close();
  server.close();
}
