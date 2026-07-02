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
- **No Node locally** — `pip install nodejs-bin`, run via `python -c "import nodejs; nodejs.node.run([...])"`.

## Stack
Single-file React 18 PWA. CDN React (unpkg UMD), no bundler. Everything inline in `app.js`
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
- **Instrument Workshop** (free retention hook): correct answers accumulate (`BUILD_STAGES`,
  cumulative — streak-independent) toward building a layered-SVG `Instrument` (guitar/violin/banjo).
  Stages: pick instrument → cut body + pick material (wood/brass/cherry/sky) → neck → sound hole →
  strings = finished → `nq-shelf`. `WorkshopModal` (choice/reveal), `WorkshopSheet` (🔨 header
  button: progress + shelf). State in `nq-build`/`nq-shelf`. ~24 correct per instrument.
- **IAP** (`IAP` object): RevenueCat entitlement `pro`, product `pro_unlock`. Native path uses
  the Capacitor plugin (`window.Purchases`, key `window.__RC_KEY__`); web/PWA falls back to a local
  unlock (`nq-pro`) so it's testable on Pages. `UpgradeSheet` does purchase + restore. No dev toggle.
- `PRICE` constant = single source of truth. `track()` PostHog helper (`app.loaded`, `paywall.shown`,
  `upgrade.completed`, `sticker.earned`, `run.ended`, `iap.*`). All localStorage keys `nq-` prefixed.

## To Port From Jazz Guitar Lab
- **Real instrument samples** for nicer note playback.
- **Onboarding / tour** patterns.
- ~~`IAP` module~~ — ported (see above). Wire `window.Purchases` + `__RC_KEY__` in the iOS build.

## Freemium Split
- **Free:** treble-clef notes E4–F5, endless mode, score & streak.
- **Pro:** ledger-line notes (incl. middle C), bass clef, sharps/flats, extra game modes.
  One-time IAP, **no subscription**.

## Pricing — TBD
`PRICE` = **`$4.99` placeholder**. Kids' note-reading apps skew cheap and competitive; $2.99–$4.99
one-time is the likely range. A **studio/teacher license** (bulk unlock) is worth exploring given
the teacher channel. Research before launch. Update only the `PRICE` constant.

## Next Session Priorities
1. ✅ Bass clef mode + Pro note pools through the gate.
2. ✅ Game modes (timed, lives, results) + kid reward animations (confetti + stickers).
3. ✅ Port the `IAP` module (RevenueCat) — replaces the dev toggle; web fallback for Pages.
4. ✅ Sharps/flats Pro tier (accidental glyph + ♮/♯/♭ answer UI + semitone audio).
5. ✅ Capacitor iOS scaffold: `capacitor.config.json` (webDir `www`), `scripts/prepare-www.mjs`
   (esbuild-bundles `native/rc-bridge.mjs` → `www/native.js`, sets `window.Purchases`+`__RC_KEY__`),
   `codemagic.yaml` (generates `ios/`, syncs, TestFlight), app icons. Run `npx cap add ios` in CI.
6. **Teacher outreach kit** (printable + studio-license concept) — the growth lever.
7. Pricing research → set `PRICE` (consider a studio/teacher bulk license).
