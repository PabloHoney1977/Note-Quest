# Note Quest — Project Context

## What this is
A **kids' music note-reading game** — read the note on the staff, tap its letter, build a streak.
Part of a "music-app studio" strategy: one shared engine (music theory + Web Audio + interactive
SVG + freemium paywall + Capacitor/RevenueCat/PostHog pipeline) reused across apps that
**cross-promote each other**. Sibling repos: `Jazz-Guitar-App`, `Piano-Chords-Lab`.

**Strategic edge (why this app exists):** note-reading apps have a uniquely organic growth
channel — **music teachers recommend them to their whole studio** (cf. "Note Rush"). That
word-of-mouth is the lever that beats the no-ad-budget discovery ceiling on the other apps.
The "teacher outreach kit" on the roadmap is therefore a priority, not an afterthought.

## Workflow Preferences (same as the other apps)
- Always use model **claude-opus-4-8**.
- Commit fixes without being asked; push immediately. App served from `main` via **GitHub Pages**
  (root, `main` branch) — landing on `main` = live. No build step.
- **`gh` CLI is NOT installed.** Create repos/Pages via the GitHub REST API using the cached git
  credential: `TOKEN=$(printf "protocol=https\nhost=github.com\n\n" | git credential fill | sed -n 's/^password=//p')`
  then curl/python `api.github.com` (token has `repo` scope).
- **Node IS available locally** (v24.18 as of 2026-10-24) — `npm ci`, `npm test`, `npm run build` all
  work on this machine. (Older note said "no Node locally / use `pip install nodejs-bin`" — stale.)
- **Tests:** `npm test` (`node --test test/*.test.cjs`). `test/harness.cjs` evals `app.js` with stubbed
  browser globals to unit-test its top-level logic, since the app has no exports/build step.

## Stack
Single-file React 18 PWA. React 18.2.0 UMD vendored in `vendor/` (no CDN — works offline/native), no bundler. Everything inline in `app.js`
(`e()` = `React.createElement`). Two `:root` theme blocks in `index.html` (light default —
kid-friendly — + `[data-theme="dark"]`). Capacitor iOS + Codemagic wired (native RevenueCat
bridge bundled via esbuild; web app stays build-free — see the Capacitor scaffold below).

## What's Built (current `app.js`)
A complete, playable **treble + bass clef note-reading game** with modes, rewards, and IAP:
- Staff model: `step` integer where 0 = the bottom line, +1 per diatonic step (−7px y). Geometry
  is clef-independent; `buildSteps(rootLetter,rootOct,…)` derives step→{letter,octave} from the
  note on the bottom line. `CLEFS` = { treble (E4), bass (G2) }, each with `free` (on-staff) and
  `pro` (ledger incl. middle C) step pools. `buildPool(isPro,clefMode)` → `{clef,step}` questions.
- `Staff` SVG: 5 lines, clef glyph (decorative), note head + stem (flips at the middle line),
  generic ledger lines. `translateZ(0)` compositing hint (iOS filtered-SVG gotcha).
- Game loop: random note → tap one of 7 letters → audio `tone()` + correct/wrong flash → next.
  Score (+10 +streak bonus), streak, persisted best (`nq-best`).
- **Modes** (`MODES`): Endless (free), Timed 60s & Lives ×3 (Pro). Run/results state machine
  (`phase`), `Results` screen (score / accuracy / best streak / sticker shelf).
- **Rewards**: streak milestones (every 5) fire a confetti burst + popping sticker badge;
  collectible `STICKERS` persisted in `nq-stickers`. Keyframes `nq-fall/nq-badge/nq-pop` in `index.html`.
- **Sharps/flats** (`nq-acc`, Pro): opt-in toggle. `pick()` attaches a sensible ♯/♭ (~45% of eligible
  notes, skipping E♯/B♯/C♭/F♭); `Staff` draws the accidental glyph; answer needs a ♮/♯/♭ pick
  (`selAcc`) + the letter; audio shifts a semitone.
- **Instrument Workshop** (free retention hook): correct answers accumulate (cumulative,
  streak-independent) toward `BUILD_STAGES` — and **every stage is a customization choice** baked
  into an accumulating `cfg`: instrument (guitar/violin/banjo) → body shape (classic/slim/chunky) →
  color (6 finishes) → sound hole (round/f/star/heart) → strings (silver/gold/rainbow) → sticker
  decal. `Instrument` renders `cfg` as layered SVG (shape = scaleX); each choice option shows a live
  mini-preview via `stage.pv`. Finished instrument (full `cfg`) → `nq-shelf`; then a fresh build
  begins. `WorkshopModal` (choice + completion), `WorkshopSheet` (🔨 header: progress + shelf).
  State in `nq-build`(`{step,prog,cfg}`)/`nq-shelf`(`[{cfg}]`). ~29 correct per instrument.
  Finished/in-progress instruments are **playable** — `PlayableInstrument` taps `playInstrument(cfg)`
  to strum a C-major chord with per-instrument timbre (`TIMBRE`: guitar pluck / banjo bright / violin
  bowed) + an `nq-strum` wiggle.
- **IAP** (`IAP` object): RevenueCat entitlement `pro`, product `pro_unlock`. Native path uses
  the Capacitor plugin (`window.Purchases`, key `window.__RC_KEY__`); web/PWA falls back to a local
  unlock (`nq-pro`) so it's testable on Pages. `UpgradeSheet` does purchase + restore. No dev toggle.
- **App Store / Kids-category compliance:** `ParentalGate` (spelled-out multiplication + keypad) guards
  purchase, restore and the external Privacy/Support links (`Footer`). `IS_NATIVE` → `track()` is a
  no-op in the iOS app (Kids category bars third-party analytics) and `IAP` never takes the web
  local-unlock path natively. Native price label comes from the store (`IAP.price`, localized).
  `navigator.audioSession.type='playback'` so sound plays with the silent switch on.
  Submission kit (listing copy, privacy label, review notes, manual steps): `STORE.md`.
- `PRICE` constant = web fallback label only (native shows the store's localized price). `track()` PostHog helper (`app.loaded`, `paywall.shown`,
  `upgrade.completed`, `sticker.earned`, `run.ended`, `iap.*`). All localStorage keys `nq-` prefixed.

## To Port From Jazz Guitar Lab
- **Real instrument samples** for nicer note playback.
- **Onboarding / tour** patterns.
- ~~`IAP` module~~ — ported (see above). Wire `window.Purchases` + `__RC_KEY__` in the iOS build.

## Freemium Split
- **Free:** treble-clef notes E4–F5, endless mode, score & streak.
- **Pro:** ledger-line notes (incl. middle C), bass clef, sharps/flats, extra game modes.
  One-time IAP, **no subscription**.

## Pricing — researched 2026-10-24, recommend keeping `$4.99`
`PRICE` = **`$4.99`** (web fallback label only; native reads the store's localized price).

Market check: **Note Rush — the category leader and the app teachers already recommend — is
`$8.99`, paid up front, with no free tier** (historical low $4.99). That shapes the position:
- Note Quest is **free to try with a $4.99 unlock**, so it undercuts Note Rush on commitment while
  capturing ~55% of its price. Free entry is what makes the **teacher channel** work — a teacher can
  tell a whole studio "download it, it's free" and parents convert later. A paid-upfront app can't be
  recommended studio-wide that frictionlessly.
- **Don't go to $2.99.** Marketing is organic-only (no paid acquisition), so net-per-sale matters more
  than install volume. With the Apple Small Business Program (15%), $4.99 nets ~$4.24 vs ~$2.54.
- There is **headroom to $5.99–$6.99** later; raising an unlock price is easy, cutting it trains the
  audience to wait for sales. Ship at $4.99.

Still open: a **studio/teacher bulk license**. The App Store has no native multi-seat IAP, so this
means either Volume Purchase Program (Apple Business/Education Manager) or a promo-code batch — worth
exploring *after* v1 ships, not a launch blocker.

## Next Session Priorities
1. ✅ Bass clef mode + Pro note pools through the gate.
2. ✅ Game modes (timed, lives, results) + kid reward animations (confetti + stickers).
3. ✅ Port the `IAP` module (RevenueCat) — replaces the dev toggle; web fallback for Pages.
4. ✅ Sharps/flats Pro tier (accidental glyph + ♮/♯/♭ answer UI + semitone audio).
5. ✅ Capacitor iOS scaffold: `capacitor.config.json` (webDir `www`), `scripts/prepare-www.mjs`
   (esbuild-bundles `native/rc-bridge.mjs` → `www/native.js`, sets `window.Purchases`+`__RC_KEY__`),
   `codemagic.yaml` (generates `ios/`, syncs, TestFlight), app icons. Run `npx cap add ios` in CI.
6. ✅ App Store readiness: parental gate, native-safe IAP + localized price, analytics off natively,
   vendored React, Info.plist patches in `codemagic.yaml`, `STORE.md`. Remaining steps are manual —
   see `STORE.md` → "Still to do by hand" (privacy policy covering kids is the big one).
7. ✅ **Pricing researched → `$4.99`** (2026-10-24). See `## Pricing` above.
8. ✅ **Ported the two Jazz-Guitar-Lab launch lessons** (2026-10-24) — both were real bugs here:
   - **Pro leak closed.** The public web build (this repo is public with Pages on) unlocked all of Pro
     on one tap via the "web fallback". Now gated behind `?dev=1` → `IS_DEV` (sticky as `nq-dev`);
     `purchase()`/`restore()` fail closed otherwise, and `UpgradeSheet` shows an App Store pitch
     instead of a dead button. Native is unaffected and never honours the flag.
   - **Blank-screen boot risk closed.** `#root` now ships a boot placeholder + a watchdog (window
     `error` or 5s) that offers Reload, and the `ReactDOM` mount is in try/catch. Guarded by a
     `__nqMounted` flag so a later error can't wipe a running app.
   - `test/shipping.test.cjs` guards both; **verified they actually fail when each bug is put back.**
9. **Test suite: `npm test` → 35 tests** (`test/theory.test.cjs` + `test/shipping.test.cjs`), wired
   into `codemagic.yaml` before the build. The whole staff/pitch map is asserted on both clefs.
10. **Teacher outreach kit** (printable + studio-license concept) — the growth lever, still to do.
11. **Open decisions blocking submission — see `STORE.md`:** (a) **Kids Category yes/no** (it's a
    one-way door, and opting out forces the "for kids" wording out of the subtitle/description per
    guideline 2.3.8); (b) **the bundle ID** — repo says `com.musicappstudio.notequest`, but the
    portfolio convention is `com.pablohoney.*` (Archtone ships `com.pablohoney.jazzguitarlab`), and
    it can't change after the first submission.

## Portfolio status — the business chain is DONE (verified 2026-10-24)
Checked against the **Jazz Guitar App repo's CLAUDE.md**, which is the live source of truth for
account status. ⚠️ The `highland-music-site` ops hub is **stale** (last updated 2026-07-15) and makes
the EIN look like an open blocker — it isn't.
- ✅ Apple account = **Organization**, `Highland Music LLC` is the seller. ✅ EIN received 2026-08-16.
- ✅ LLC checking + W-9 + **Paid Applications Agreement ACTIVE** (2026-08-24) — IAP can be sold.
- ✅ **Archtone (Jazz Guitar Lab) is already live on the App Store** with five 5★ reviews and a live
  `$14.99 pro_unlock`. So Codemagic → TestFlight → App Review is a **proven** path for this stack.
- ⚠️ `npm test`/`npm run build` verified locally 2026-10-24; the **iOS build itself is still unrun** —
  `ios/` is generated in CI, so the first Codemagic run is the first real compile.
