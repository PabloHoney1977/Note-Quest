/* Music-theory and freemium-gate tests.
 * These guard the one class of bug that would be most damaging for this app: a note drawn on the
 * staff that names the wrong letter. Piano teachers are the growth channel (CLAUDE.md) and they
 * would spot it instantly, so every pitch on both clefs is asserted against the real staff. */
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./harness.cjs');

const A = load();

/* ── Staff geometry ── */
test('step 0 sits on the bottom line and each step up is half a line space', () => {
  assert.strictEqual(A.yForStep(0), A.BOTTOM_Y);
  assert.strictEqual(A.yForStep(2) - A.yForStep(0), -A.LS);  // one whole line space up
  assert.strictEqual(A.yForStep(8), A.BOTTOM_Y - 4 * A.LS);  // top line = 4 spaces above bottom
});

test('ledger lines are flagged only outside the five staff lines', () => {
  for (let s = 0; s <= 8; s++) {
    assert.ok(!A.needsLedgerBelow(s) && !A.needsLedgerAbove(s), `step ${s} is on-staff`);
  }
  // step 9 / -1 are the spaces just outside the staff — still no ledger line needed.
  assert.ok(!A.needsLedgerBelow(-1) && !A.needsLedgerAbove(9));
  assert.ok(A.needsLedgerBelow(-2), 'middle C in treble needs a ledger line');
  assert.ok(A.needsLedgerAbove(10), 'A5 in treble needs a ledger line');
});

/* ── Pitch mapping: the full staff, both clefs ── */
const TREBLE = {
  '-2': 'C4', '-1': 'D4', 0: 'E4', 1: 'F4', 2: 'G4', 3: 'A4', 4: 'B4',
  5: 'C5', 6: 'D5', 7: 'E5', 8: 'F5', 9: 'G5', 10: 'A5',
};
const BASS = {
  '-2': 'E2', '-1': 'F2', 0: 'G2', 1: 'A2', 2: 'B2', 3: 'C3', 4: 'D3',
  5: 'E3', 6: 'F3', 7: 'G3', 8: 'A3', 9: 'B3', 10: 'C4',
};

for (const [clef, expected] of [['treble', TREBLE], ['bass', BASS]]) {
  test(`${clef} clef maps every step to the right pitch`, () => {
    const steps = A.CLEFS[clef].steps;
    for (const [step, name] of Object.entries(expected)) {
      const n = steps[step];
      assert.strictEqual(n.l + n.o, name, `${clef} step ${step} should be ${name}`);
    }
  });
}

test('the five treble lines are E4 G4 B4 D5 F5 and its spaces are F4 A4 C5 E5', () => {
  const s = A.CLEFS.treble.steps;
  assert.deepStrictEqual([0, 2, 4, 6, 8].map(i => s[i].l + s[i].o), ['E4', 'G4', 'B4', 'D5', 'F5']);
  assert.deepStrictEqual([1, 3, 5, 7].map(i => s[i].l + s[i].o), ['F4', 'A4', 'C5', 'E5']);
});

test('the five bass lines are G2 B2 D3 F3 A3 and its spaces are A2 C3 E3 G3', () => {
  const s = A.CLEFS.bass.steps;
  assert.deepStrictEqual([0, 2, 4, 6, 8].map(i => s[i].l + s[i].o), ['G2', 'B2', 'D3', 'F3', 'A3']);
  assert.deepStrictEqual([1, 3, 5, 7].map(i => s[i].l + s[i].o), ['A2', 'C3', 'E3', 'G3']);
});

test('middle C is one ledger below the treble staff and one ledger above the bass staff', () => {
  const t = A.CLEFS.treble.steps[-2], b = A.CLEFS.bass.steps[10];
  assert.strictEqual(t.l + t.o, 'C4');
  assert.strictEqual(b.l + b.o, 'C4');
  assert.strictEqual(A.midiOf(t), A.midiOf(b), 'both must be the same pitch');
  assert.strictEqual(A.midiOf(t), 60, 'middle C is MIDI 60');
});

test('midiOf matches the MIDI standard', () => {
  assert.strictEqual(A.midiOf({ l: 'A', o: 4 }), 69);   // A440
  assert.strictEqual(A.midiOf({ l: 'C', o: 0 }), 12);
  // Pitch must rise monotonically with step on both clefs.
  for (const clef of ['treble', 'bass']) {
    const s = A.CLEFS[clef].steps;
    for (let i = -1; i <= 10; i++) {
      assert.ok(A.midiOf(s[i]) > A.midiOf(s[i - 1]), `${clef}: step ${i} must be higher than ${i - 1}`);
    }
  }
});

test('buildSteps wraps letters and bumps the octave at C', () => {
  const m = A.buildSteps('E', 4, -4, 12);
  assert.strictEqual(m[5].l, 'C');
  assert.strictEqual(m[5].o, 5, 'the octave number increments at C, not at A');
  assert.strictEqual(m[4].o, 4);
});

/* ── Freemium gate ── */
test('the free pool is on-staff treble notes only, and never needs a ledger line', () => {
  const pool = A.buildPool(false, 'treble');
  assert.ok(pool.length > 0);
  assert.ok(pool.every(q => q.clef === 'treble'), 'free play is treble only');
  for (const q of pool) {
    assert.ok(!A.needsLedgerBelow(q.step) && !A.needsLedgerAbove(q.step),
      `free step ${q.step} must sit on the staff`);
  }
  const names = pool.map(q => { const n = A.CLEFS.treble.steps[q.step]; return n.l + n.o; });
  assert.deepStrictEqual(names, ['E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5']);
});

test('Pro adds the ledger-line notes, including middle C', () => {
  const free = A.buildPool(false, 'treble');
  const pro = A.buildPool(true, 'treble');
  assert.ok(pro.length > free.length, 'Pro must offer strictly more notes');
  assert.ok(pro.some(q => q.step === -2), 'Pro includes middle C');
  assert.ok(!free.some(q => q.step === -2), 'free must NOT include middle C');
});

test('clef mode "both" mixes treble and bass; single modes stay pure', () => {
  const both = A.buildPool(true, 'both');
  assert.ok(both.some(q => q.clef === 'treble') && both.some(q => q.clef === 'bass'));
  assert.ok(A.buildPool(true, 'bass').every(q => q.clef === 'bass'));
});

test('every question in every pool resolves to a real note', () => {
  for (const isPro of [false, true]) {
    for (const mode of ['treble', 'bass', 'both']) {
      for (const q of A.buildPool(isPro, mode)) {
        const n = A.CLEFS[q.clef].steps[q.step];
        assert.ok(n && A.LETTERS.includes(n.l) && Number.isInteger(n.o),
          `pool(${isPro},${mode}) step ${q.step} must map to a note`);
      }
    }
  }
});

test('pools contain no duplicate questions', () => {
  for (const mode of ['treble', 'bass', 'both']) {
    const pool = A.buildPool(true, mode);
    const keys = pool.map(q => q.clef + ':' + q.step);
    assert.strictEqual(new Set(keys).size, keys.length, `${mode} pool has duplicates`);
  }
});

/* ── Game modes ── */
test('endless is free and the other modes are gated', () => {
  assert.strictEqual(A.MODES.endless.pro, false);
  assert.strictEqual(A.MODES.timed.pro, true);
  assert.strictEqual(A.MODES.lives.pro, true);
  assert.strictEqual(A.MODES.timed.seconds, 60);
  assert.ok(A.MODES.lives.lives >= 1);
});

/* ── Accidentals ── */
test('accidental symbols and enharmonic limits are musically correct', () => {
  assert.strictEqual(A.accSym(1), '♯');
  assert.strictEqual(A.accSym(-1), '♭');
  assert.strictEqual(A.accSym(0), '');
  assert.strictEqual(A.noteName({ l: 'F' }, 1), 'F♯');
  assert.strictEqual(A.noteName({ l: 'B' }, 0), 'B');
  // E♯/B♯ and C♭/F♭ are avoided — they'd be spelled as F/C and B/E.
  assert.ok(!A.canSharp('E') && !A.canSharp('B'));
  assert.ok(!A.canFlat('C') && !A.canFlat('F'));
  for (const l of ['C', 'D', 'F', 'G', 'A']) assert.ok(A.canSharp(l), `${l}# is valid`);
  for (const l of ['D', 'E', 'G', 'A', 'B']) assert.ok(A.canFlat(l), `${l}b is valid`);
});

test('there are seven letter buttons, one per diatonic letter', () => {
  assert.strictEqual(A.LETTERS.length, 7);
  assert.deepStrictEqual([...A.LETTERS].sort(), [...A.SEQ].sort());
  assert.ok(A.LETTERS.every(l => l in A.PC), 'every letter has a pitch class');
});

/* ── Store-facing constants ── */
test('the support/privacy site is the live HTTPS Highland Music domain', () => {
  assert.strictEqual(A.SITE, 'https://highlandmusicapps.com');
  assert.ok(A.SITE.startsWith('https://'), 'App Review requires working HTTPS links');
});

test('the PRICE fallback is a plain formatted price', () => {
  assert.match(A.PRICE, /^\$\d+\.\d{2}$/);
});

test('there are stickers to award', () => {
  assert.ok(Array.isArray(A.STICKERS) && A.STICKERS.length > 0);
});
