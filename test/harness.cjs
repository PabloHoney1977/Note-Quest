/* Load app.js's top-level logic in Node so it can be unit-tested.
 * app.js is a browser script with no exports (see CLAUDE.md — single-file, no build step), so we
 * eval it inside a function with stubbed browser globals and append a return of the symbols we
 * want. React/ReactDOM are stubbed to no-ops, so the final createRoot().render() never runs App()
 * and nothing touches the DOM. */
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

// Symbols under test — everything here is pure logic, no React or DOM involved.
const EXPORTS = [
  'PC', 'SEQ', 'LS', 'BOTTOM_Y', 'yForStep', 'needsLedgerBelow', 'needsLedgerAbove',
  'midiOf', 'buildSteps', 'CLEFS', 'buildPool', 'MODES', 'STICKERS',
  'LETTERS', 'ACCIDENTALS', 'accSym', 'noteName', 'canSharp', 'canFlat', 'PRICE', 'SITE',
  'IAP',   // identifiers only — the store calls are never exercised here
];

function load() {
  const src = readFileSync(join(__dirname, '..', 'app.js'), 'utf8');

  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const React = {
    createElement: () => null,
    useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
    useCallback: (f) => f,
    useEffect: () => {},
    useRef: () => ({ current: null }),
    useMemo: (f) => f(),
  };
  const ReactDOM = { createRoot: () => ({ render: () => {} }) };
  const document = { getElementById: () => ({}), documentElement: { dataset: {} } };
  const window = { localStorage, addEventListener: () => {} };

  const body = `${src}\n;return { ${EXPORTS.join(', ')} };`;
  const fn = new Function(
    'React', 'ReactDOM', 'document', 'window', 'localStorage', 'navigator', 'AudioContext',
    body,
  );
  return fn(React, ReactDOM, document, window, localStorage, { userAgent: 'node' }, function () {});
}

module.exports = { load, EXPORTS };
