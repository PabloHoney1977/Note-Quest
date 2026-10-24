/* Render Note Quest's App Store screenshots at Apple's exact pixel sizes — no device or simulator.
 *
 *   npm i -D playwright-core      (deliberately NOT a package.json dep: it would slow every CI
 *                                  install, and this only ever runs by hand before a submission)
 *   node scripts/shoot-screenshots.cjs
 *
 * Output: C:/Users/<you>/Downloads/NoteQuest-AppStore-Screenshots/{iPhone-6.9,iPad-13}/
 *
 * How it works: serve the repo over a real origin (so localStorage behaves), drive the installed
 * Edge via playwright-core, and clip to the exact CSS canvas — deviceScaleFactor multiplies that up
 * to the pixel size Apple requires. Ported from Jazz Guitar Lab's recipe.
 *
 * Note Quest specifics worth knowing before editing:
 *  - `nq-pro:'1'` is what actually unlocks Pro. `?dev=1` / `nq-dev` only ARM the dev-unlock path; on
 *    their own they leave the 🔒 badges in place.
 *  - Every gameplay shot presets `nq-build` to a COMPLETED build ({step:6}) so advanceWorkshop()
 *    returns early and the workshop modal can't pop up mid-shot. The workshop shot overrides it.
 *  - The correct answer is not in the DOM as text, so it is derived from the note head's cy on the
 *    staff SVG (cy = 96 - step*7, see yForStep) plus the clef glyph, then walked to a letter exactly
 *    the way buildSteps does in app.js.
 */
const { chromium } = require('playwright-core');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(os.homedir(), 'Downloads', 'NoteQuest-AppStore-Screenshots');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const DEVICES = [
  { name: 'iPhone-6.9', w: 440, h: 956, dsf: 3 },   // → 1320 × 2868
  { name: 'iPad-13', w: 1032, h: 1376, dsf: 2 },    // → 2064 × 2752  (required: iPad is declared)
];

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css' };

/* the same diatonic walk app.js's buildSteps uses */
const SEQ = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const walker = (root) => { const i0 = SEQ.indexOf(root); return (s) => SEQ[(((i0 + s) % 7) + 7) % 7]; };
const LETTER = { treble: walker('E'), bass: walker('G') };

const FINISHED_BUILD = { step: 6, prog: 0, cfg: { instrument: 'guitar', shape: 'classic', color: 'wood', hole: 'round', strings: 'silver', decal: 'star' } };
const SHELF = [
  { cfg: { instrument: 'guitar', shape: 'classic', color: 'cherry', hole: 'round', strings: 'gold', decal: 'star' } },
  { cfg: { instrument: 'violin', shape: 'slim', color: 'grape', hole: 'f', strings: 'silver', decal: 'note' } },
  { cfg: { instrument: 'banjo', shape: 'wide', color: 'mint', hole: 'star', strings: 'rainbow', decal: 'bolt' } },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pngSize(file) {
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(24);
  fs.readSync(fd, buf, 0, 24, 0);
  fs.closeSync(fd);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function serve() {
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}

async function readNote(page) {
  const got = await page.evaluate(() => {
    const svg = document.querySelector('svg[viewBox="0 0 320 150"]');   // the Staff
    if (!svg) return null;
    const head = svg.querySelector('ellipse');
    const glyph = svg.querySelector('text');
    if (!head || !glyph) return null;
    return { cy: +head.getAttribute('cy'), glyph: glyph.textContent.trim() };
  });
  if (!got) return null;
  const step = Math.round((96 - got.cy) / 7);
  const clef = got.glyph === '\u{1D11E}' ? 'treble' : 'bass';
  return { step, clef, letter: LETTER[clef](step) };
}

const clickLetter = (page, L) => page.evaluate((want) => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === want);
  if (b) b.click();
}, L);

const rewardUp = (page) => page.evaluate(() =>
  /On fire!|Superstar!|Blast off!|Champion!|Legend!/.test(document.body.textContent));

async function answerRight(page) {
  const n = await readNote(page);
  if (!n) throw new Error('no note on the staff');
  await clickLetter(page, n.letter);
  await sleep(620);                                // the correct-answer flash is 520ms
  if (await rewardUp(page)) await sleep(1500);     // let a milestone celebration finish
  return n;
}

async function answerWrong(page) {
  const n = await readNote(page);
  await clickLetter(page, SEQ.find((L) => L !== n.letter));
  await sleep(1200);                               // the wrong-answer flash is 1100ms
}

const SHOTS = {
  // 1 — core gameplay, mid-run so the score and streak are populated (3 correct = 36, below the
  //     5-streak milestone, so no celebration covers the staff).
  async gameplay(page) { for (let i = 0; i < 3; i++) await answerRight(page); await sleep(250); },

  // 2 — the milestone celebration, timed so the confetti is mid-fall and the sticker badge is in.
  async streak(page) {
    for (let i = 0; i < 5; i++) {
      const n = await readNote(page);
      await clickLetter(page, n.letter);
      if (i < 4) await sleep(620);
    }
    await sleep(430);   // nq-fall is 1.2s with delays ≤0.35s
  },

  // 3 — the Instrument Workshop: a part-built instrument plus a shelf of finished ones.
  async workshop(page) { await page.click('[title="Instrument Workshop"]'); await sleep(500); },

  // 4 — bass clef showing MIDDLE C on its ledger line (step 10 in bass), the note the store
  //     description calls out by name.
  async bassclef(page) {
    for (let i = 0; i < 60; i++) {
      const n = await readNote(page);
      if (n.step === 10) { await sleep(250); return; }
      await answerRight(page);
    }
    throw new Error('never drew middle C on the bass staff');
  },

  // 5 — the results screen at the end of a Lives run.
  async results(page) {
    for (let i = 0; i < 7; i++) await answerRight(page);
    for (let i = 0; i < 3; i++) await answerWrong(page);
    await sleep(600);
  },

  // 6 — the paywall. Doubles as the IAP review screenshot App Store Connect requires, which is why
  //     it runs with nq-dev so the real "Unlock Pro — $4.99" button renders instead of the
  //     "Coming to the App Store" note the public web build shows.
  async paywall(page) {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /Bass clef, game modes/.test(x.textContent));
      if (b) b.click();
    });
    await sleep(600);
  },
};

const STATE = {
  gameplay: { 'nq-pro': '1', 'nq-clef': 'treble', 'nq-mode': 'endless', 'nq-best': '24' },
  streak: { 'nq-pro': '1', 'nq-clef': 'treble', 'nq-mode': 'endless', 'nq-best': '24' },
  workshop: { 'nq-pro': '1', 'nq-best': '24' },
  bassclef: { 'nq-pro': '1', 'nq-clef': 'bass', 'nq-mode': 'endless', 'nq-best': '24' },
  results: { 'nq-pro': '1', 'nq-clef': 'treble', 'nq-mode': 'lives', 'nq-best': '24' },
  paywall: { 'nq-pro': '0', 'nq-dev': '1', 'nq-best': '12' },
};
const ORDER = ['gameplay', 'streak', 'workshop', 'bassclef', 'results', 'paywall'];

(async () => {
  const srv = await serve();
  const port = srv.address().port;
  const browser = await chromium.launch({ executablePath: EDGE, args: ['--hide-scrollbars'] });
  let bad = 0, total = 0;

  for (const dev of DEVICES) {
    const dir = path.join(OUT, dev.name);
    fs.mkdirSync(dir, { recursive: true });

    for (let i = 0; i < ORDER.length; i++) {
      const shot = ORDER[i];
      const ctx = await browser.newContext({
        viewport: { width: dev.w, height: dev.h },
        deviceScaleFactor: dev.dsf,
        serviceWorkers: 'block',           // keep a stale SW cache out of the render
      });
      const state = {
        ...STATE[shot],
        'nq-theme': 'light',               // the app opens light; the store page should match
        'nq-stickers': JSON.stringify([5, 10, 15]),
        'nq-shelf': JSON.stringify(SHELF),
        'nq-build': JSON.stringify(shot === 'workshop'
          ? { step: 3, prog: 2, cfg: { instrument: 'guitar', shape: 'slim', color: 'sky' } }
          : FINISHED_BUILD),
      };
      await ctx.addInitScript((s) => {
        try { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } catch (_) {}
      }, state);

      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(String(e)));
      await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__nqMounted === true, { timeout: 15000 });
      await sleep(350);

      try { await SHOTS[shot](page); }
      catch (e) { console.log(`  ! ${dev.name}/${shot}: ${e.message}`); }

      const file = path.join(dir, `${i + 1}-${shot}.png`);
      await page.screenshot({ path: file, clip: { x: 0, y: 0, width: dev.w, height: dev.h } });
      const { width, height } = pngSize(file);
      const ok = width === dev.w * dev.dsf && height === dev.h * dev.dsf;
      total++; if (!ok) bad++;
      console.log(`${ok ? 'OK  ' : 'BAD '} ${dev.name}/${i + 1}-${shot}.png  ${width}x${height}` +
        (errs.length ? `  pageerrors: ${errs.length}` : ''));
      errs.slice(0, 2).forEach((x) => console.log('      ' + x.split('\n')[0]));
      await ctx.close();
    }
  }

  await browser.close();
  srv.close();
  console.log(`\n${total - bad}/${total} at the exact required size`);
  console.log(`Output: ${OUT}`);
  if (bad) process.exitCode = 1;
})();
