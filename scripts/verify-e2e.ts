/**
 * Manual E2E smoke check. Start the dev server first:
 *   npx vite --port 5199 &
 *   npx tsx scripts/verify-e2e.ts
 *
 * Uses CDP attach because the snap-packaged Chromium cannot inherit
 * Playwright's --remote-debugging-pipe file descriptors.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const URL = process.env.APP_URL ?? 'http://localhost:5199';
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/usr/bin/chromium-browser';
const CDP_PORT = 9222;

async function waitForCdp(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Chromium CDP endpoint never came up');
}

async function main() {
  const profile = mkdtempSync(join(homedir(), '.sat-tracker-e2e-'));
  const proc = spawn(
    CHROMIUM,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--enable-unsafe-swiftshader',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const cleanup = () => {
    proc.kill('SIGKILL');
    rmSync(profile, { recursive: true, force: true });
  };

  try {
    await waitForCdp(30_000);
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
    const ctx = browser.contexts()[0] ?? (await browser.newContext());
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });

    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
    });

    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#boot.done', { state: 'attached', timeout: 90_000 });

    const status = await page
      .waitForFunction(
        () => {
          const m = document.body.innerText.match(/([\d,]+) objects tracked/);
          return m ? m[1] : false;
        },
        undefined,
        { timeout: 90_000 },
      )
      .then((h) => h.jsonValue());
    console.log(`Catalog loaded: ${status} objects tracked`);

    await page.waitForTimeout(3000);
    const nonBlack = await page.evaluate(() => {
      const src = document.getElementById('scene') as HTMLCanvasElement;
      const c = document.createElement('canvas');
      c.width = 200; c.height = 200;
      const ctx2 = c.getContext('2d')!;
      ctx2.drawImage(src, 0, 0, 200, 200);
      const d = ctx2.getImageData(0, 0, 200, 200).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 30) n++;
      return n;
    });
    console.log(`Canvas sample: ${nonBlack}/40000 lit pixels`);
    if (nonBlack < 500) throw new Error('Canvas appears blank');

    await page.fill('input[type="search"], input[placeholder*="earch"]', 'ISS');
    await page.waitForTimeout(500);
    const hasResult = await page.evaluate(() => /ISS|ZARYA/i.test(document.body.innerText));
    console.log(`Search results for "ISS": ${hasResult ? 'found' : 'NOT FOUND'}`);

    await page.screenshot({ path: '/tmp/sat-tracker-verify.png' });
    console.log('Screenshot: /tmp/sat-tracker-verify.png');
    await browser.close();

    const fatal = errors.filter((e) => !/favicon|404/i.test(e));
    if (fatal.length) {
      console.error('Page errors:\n' + fatal.join('\n'));
      process.exit(1);
    }
    console.log('E2E smoke check passed.');
  } finally {
    cleanup();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });