/* Static guards on the two mistakes that are expensive to ship.
 * Both were paid for once already on Jazz Guitar Lab (see its CLAUDE.md): the public web build gave
 * the whole Pro product away for free, and a failed script left a blank page that reads as a broken
 * app to App Review. These are source-level checks on purpose — they fail loudly if a future edit
 * reintroduces either, without needing a browser. */
const test = require('node:test');
const assert = require('node:assert');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const read = (f) => readFileSync(join(root, f), 'utf8');
const appjs = read('app.js');
const html = read('index.html');

/* ── Pro must not leak on the public web build ── */
test('the dev unlock is opt-in behind ?dev=1, not the default', () => {
  assert.match(appjs, /IS_DEV/, 'IS_DEV flag must exist');
  assert.match(appjs, /dev=1/, 'the unlock must be gated on an explicit ?dev=1 opt-in');
  assert.match(appjs, /nq-dev/, 'the opt-in should persist under the nq- prefix');
});

test('purchase() and restore() fail closed with no store and no dev flag', () => {
  for (const method of ['purchase', 'restore']) {
    // Grab the method body up to the following `try {`.
    const m = appjs.match(new RegExp(`async ${method}\\(\\)\\{([\\s\\S]*?)try \\{`));
    assert.ok(m, `${method}() should be found`);
    const body = m[1];
    assert.match(body, /if \(!IS_DEV\) return \{ ok:false/,
      `${method}() must refuse to unlock without the dev flag — otherwise the public ` +
      'GitHub Pages build hands out all of Pro for free');
    // The unconditional `_set(true)` that caused the leak must not sit outside a dev guard.
    const setTrue = body.indexOf('_set(true)');
    if (setTrue !== -1) {
      assert.ok(body.lastIndexOf('IS_DEV', setTrue) !== -1,
        `${method}(): _set(true) must come after an IS_DEV guard`);
    }
  }
});

test('native builds never take a local-unlock path', () => {
  for (const method of ['purchase', 'restore']) {
    const m = appjs.match(new RegExp(`async ${method}\\(\\)\\{([\\s\\S]*?)try \\{`));
    assert.match(m[1], /if \(IS_NATIVE\) return \{ ok:false \}/,
      `${method}() must fail closed on native when the store is unavailable`);
  }
});

test('IS_DEV is forced off on native', () => {
  const m = appjs.match(/const IS_DEV = \(\(\) => \{([\s\S]*?)\}\)\(\);/);
  assert.ok(m, 'IS_DEV should be a guarded IIFE');
  assert.match(m[1], /if \(IS_NATIVE\) return false/,
    'a native build must never honour the dev unlock');
});

/* ── The app must never boot to a blank page ── */
test('#root is not empty before React mounts', () => {
  assert.doesNotMatch(html, /<div id="root"><\/div>/,
    'an empty #root renders as a blank page if a script fails');
  assert.match(html, /id="nq-boot"/, 'a boot placeholder must be present');
  assert.match(html, /id="nq-boot-reload"/, 'the failure state needs a Reload button');
});

test('the boot watchdog is registered before the scripts it guards', () => {
  const watchdog = html.indexOf('__nqBootFail');
  const react = html.indexOf('vendor/react.production.min.js');
  const app = html.indexOf('src="app.js"');
  assert.ok(watchdog !== -1 && react !== -1 && app !== -1);
  assert.ok(watchdog < react, 'the watchdog must load before React so it catches its failure');
  assert.ok(watchdog < app, 'the watchdog must load before app.js');
  assert.match(html, /addEventListener\('error'/, 'it must listen for script errors');
  assert.match(html, /setTimeout/, 'it needs a timeout so a silent hang still surfaces');
});

test('the watchdog cannot wipe an app that already mounted', () => {
  assert.match(html, /window\.__nqMounted/, 'the watchdog must check a mounted flag');
  assert.match(appjs, /window\.__nqMounted = true/, 'app.js must set the mounted flag');
});

test('the mount is wrapped so a throw shows the friendly state, not a blank page', () => {
  const m = appjs.match(/try \{[\s\S]*ReactDOM\.createRoot[\s\S]*?\} catch \(err\) \{([\s\S]*?)\}/);
  assert.ok(m, 'the ReactDOM mount must sit inside try/catch');
  assert.match(m[1], /__nqBootFail/, 'the catch must surface the boot-failure UI');
});

/* ── No third-party requests: required for offline boot AND for the Kids Category ── */
test('React is vendored locally, with no remote script tags', () => {
  assert.match(html, /vendor\/react\.production\.min\.js/);
  assert.match(html, /vendor\/react-dom\.production\.min\.js/);
  const remote = html.match(/<script[^>]+src=["'](https?:)?\/\/[^"']+/g);
  assert.strictEqual(remote, null,
    `no remote <script> allowed — it breaks offline boot and sends requests to third parties: ${remote}`);
});

test('app.js makes no network requests at all', () => {
  for (const pattern of [/\bfetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /new WebSocket/]) {
    assert.doesNotMatch(appjs, pattern,
      `${pattern} in app.js — Kids Category apps must not send data to third parties`);
  }
});

test('the only link out of the app is behind the parental gate', () => {
  const opens = appjs.match(/window\.open\(/g) || [];
  assert.strictEqual(opens.length, 1, 'exactly one outbound link path is expected');
  // It must sit inside a ParentalGate onPass handler.
  assert.match(appjs, /ParentalGate,\{ onPass:\(\)=>\{ window\.open\(/,
    'external links must open only after the parental gate passes');
});

test('analytics are inert: no analytics script is ever loaded', () => {
  assert.doesNotMatch(html, /posthog[^"']*\.js|app\.posthog\.com|us\.i\.posthog\.com/i,
    'no analytics snippet may load — the Kids Category forbids third-party analytics');
  assert.match(appjs, /const track = \(ev, props\) => \{ if \(IS_NATIVE\) return;/,
    'track() must no-op on native');
});

/* ── Store metadata consistency ── */
test('the bundle id matches between capacitor config and CI', () => {
  const appId = JSON.parse(read('capacitor.config.json')).appId;
  assert.match(appId, /^[a-z0-9.]+$/, 'bundle ids are lowercase dotted');
  assert.ok(read('codemagic.yaml').includes(appId),
    `codemagic.yaml BUNDLE_ID must match capacitor.config.json appId (${appId})`);
});

test('the legal name has no comma, matching the WI Articles', () => {
  for (const f of ['app.js', 'STORE.md']) {
    assert.doesNotMatch(read(f), /Highland Music, LLC/,
      `${f}: the exact legal name is "Highland Music LLC" — no comma`);
  }
});

test('CI runs the tests before building', () => {
  const ci = read('codemagic.yaml');
  // Match the step lines, not prose — "npm run build" is also mentioned in a comment above them.
  const test_ = ci.indexOf('script: npm test');
  const build = ci.indexOf('script: npm run build');
  assert.ok(test_ !== -1, 'codemagic.yaml must run the test suite');
  assert.ok(build !== -1, 'codemagic.yaml must run the web build');
  assert.ok(test_ < build, 'tests should run before the build');
});
