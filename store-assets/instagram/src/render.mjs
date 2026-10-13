// Instagram "artık yayında" görsellerini template.html'den PNG olarak üretir.
//   node store-assets/instagram/src/render.mjs
// Playwright + Chromium gerekir (global playwright paketi yeterli: NODE_PATH ile).
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// require() NODE_PATH'i dikkate alır, ESM import'u almaz — global kurulum için.
const { chromium } = createRequire(import.meta.url)('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '..');
const template = pathToFileURL(path.join(here, 'template.html')).href;

const JOBS = [
  { f: 'post', w: 1080, h: 1350, out: 'nottepe_yayinda_post_1080x1350.png' },
  { f: 'story', w: 1080, h: 1920, out: 'nottepe_yayinda_story_1080x1920.png' },
];

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
try {
  for (const job of JOBS) {
    const page = await browser.newPage({
      viewport: { width: job.w, height: job.h },
      deviceScaleFactor: 1,
    });
    await page.goto(`${template}?f=${job.f}`);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        [...document.images].map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r)))),
      );
    });
    await page.locator('#canvas').screenshot({ path: path.join(outDir, job.out) });
    await page.close();
    console.log('✓', job.out);
  }
} finally {
  await browser.close();
}
