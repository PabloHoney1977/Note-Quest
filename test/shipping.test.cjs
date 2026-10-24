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

test('no analytics anywhere: the Kids Category forbids it outright', () => {
  // Guideline 1.3 — no third-party analytics, and no device info to third parties. This is a
  // standing constraint for this app, so track() must be an unconditional no-op.
  assert.match(appjs, /const track = \(_ev, _props\) => \{\};/,
    'track() must be a permanent no-op, not conditional');
  for (const f of ['app.js', 'index.html']) {
    assert.doesNotMatch(read(f), /posthog/i,
      `${f}: no analytics SDK or key may appear — Kids Category apps may not include analytics`);
  }
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

/* ── CI config: each of these was a real failure on the sibling app ── */
test('the iOS build targets the Xcode project, not a workspace', () => {
  const ci = read('codemagic.yaml');
  // Capacitor 8 uses Swift Package Manager: there is no Podfile and no .xcworkspace.
  assert.doesNotMatch(ci, /xcworkspace/,
    'SPM projects have no .xcworkspace — xcodebuild must target ios/App/App.xcodeproj');
  assert.doesNotMatch(ci, /^\s*cocoapods:/m,
    'this is an SPM project; a cocoapods key makes Codemagic look for a Podfile that does not exist');
  assert.match(ci, /--project ios\/App\/App\.xcodeproj/, 'build-ipa must use --project');
  assert.match(ci, /-resolvePackageDependencies/,
    'Swift packages must be resolved before build-ipa, or it fails with status 74');
});

test('code signing creates the cert and profile rather than only fetching them', () => {
  const ci = read('codemagic.yaml');
  assert.match(ci, /keychain initialize/);
  assert.match(ci, /fetch-signing-files/);
  assert.match(ci, /--create/,
    'a bundle id that has never been built has no profile to fetch — it must be created');
  assert.match(ci, /--certificate-key @env:CERTIFICATE_PRIVATE_KEY/,
    'fetch-signing-files --create cannot build a cert without a private key to derive it from');
  assert.doesNotMatch(ci, /^\s*ios_signing:/m,
    'an ios_signing block triggers automatic signing, which aborts before these scripts run');
});

test('CI reuses the existing App Store Connect integration and credential groups', () => {
  const ci = read('codemagic.yaml');
  assert.match(ci, /app_store_connect: Codemagic CI/,
    'reuse the account-wide integration named "Codemagic CI"');
  for (const group of ['appstore_credentials', 'revenuecat']) {
    assert.match(ci, new RegExp(`- ${group}\\b`), `the ${group} variable group must be referenced`);
  }
});

test('the app icon step fails the build instead of shipping a placeholder', () => {
  const ci = read('codemagic.yaml');
  assert.match(ci, /@capacitor\/assets generate --ios/);
  assert.doesNotMatch(ci, /@capacitor\/assets generate --ios[^\n]*\|\|/,
    'the icon step must not swallow failures — a placeholder icon is an automatic rejection');
  assert.match(ci, /AppIcon-512@2x\.png/, 'the generated icon should be verified');
  const assets = JSON.parse(read('package.json')).devDependencies['@capacitor/assets'];
  assert.ok(assets, '@capacitor/assets must be a pinned devDependency, not an unpinned npx fetch');
});

test('TestFlight only — the App Store submission stays manual', () => {
  const ci = read('codemagic.yaml');
  assert.match(ci, /submit_to_testflight: true/);
  assert.match(ci, /submit_to_app_store: false/,
    'releases are submitted by hand from App Store Connect');
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
