/* Build the Capacitor web bundle (www/). No bundler for the app itself — this just stages the
 * static files, bundles the native RevenueCat bridge, and injects it into the native index.html.
 * The GitHub Pages build serves the repo root directly and never sees www/ or native.js. */
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const WWW = 'www';
rmSync(WWW, { recursive: true, force: true });
mkdirSync(WWW, { recursive: true });

for (const f of ['index.html', 'app.js', 'sw.js', 'manifest.json']) cpSync(f, `${WWW}/${f}`);
if (existsSync('icons')) cpSync('icons', `${WWW}/icons`, { recursive: true });

// Bundle the native-only RevenueCat bridge. RC_IOS_KEY is embedded from the env (set in Codemagic).
const key = process.env.RC_IOS_KEY || '';
await build({
  entryPoints: ['native/rc-bridge.mjs'],
  bundle: true,
  format: 'iife',
  outfile: `${WWW}/native.js`,
  define: { RC_IOS_KEY: JSON.stringify(key) },
  logLevel: 'warning',
});

// Load native.js before app.js — only in the Capacitor copy of index.html.
const idx = `${WWW}/index.html`;
let html = readFileSync(idx, 'utf8');
if (!html.includes('native.js')) {
  html = html.replace('<script src="app.js"></script>', '<script src="native.js"></script>\n  <script src="app.js"></script>');
  writeFileSync(idx, html);
}

console.log('www/ ready' + (key ? ' (RevenueCat key embedded)' : ' — no RC_IOS_KEY set; store purchases will no-op'));
