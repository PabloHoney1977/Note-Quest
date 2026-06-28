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
kid-friendly — + `[data-theme="dark"]`). Capacitor iOS + Codemagic to be added.

## What's Built (current `app.js`)
A complete, playable **treble-clef note-reading loop**:
- Staff model: `step` integer where 0 = E4 = bottom line, +1 per diatonic step (−7px y).
  `STEP_NOTES` maps step→{letter,octave}; `FREE_STEPS` = E4..F5 (on-staff, no ledger);
  `PRO_STEPS` = middle-C ledger, D4, G5, A5.
- `Staff` SVG: 5 lines, unicode treble clef glyph (decorative), note head + stem, ledger lines
  drawn when `needsLedgerBelow/Above`. `translateZ(0)` compositing hint (iOS filtered-SVG gotcha).
- Game loop: random note → tap one of 7 letter buttons → audio `tone()` + correct/wrong flash →
  next note. Score (+10 +streak bonus), streak, persisted best (`nq-best`).
- Freemium: free pool = `FREE_STEPS`; Pro adds `PRO_STEPS` + (future) bass clef/sharps via
  `UpgradeSheet`. localStorage keys prefixed `nq-`.
- `PRICE` constant = single source of truth. `track()` PostHog helper + `__POSTHOG_KEY__` placeholder.

## To Port From Jazz Guitar Lab
- **`IAP` module** (RevenueCat, entitlement `pro`, product `pro_unlock`) — swap prefixes to `nq-`.
- **Real instrument samples** for nicer note playback.
- **Onboarding / tour / streak-milestone** patterns (kids respond well to reward animations —
  consider stickers/badges instead of the adult streak UI).

## Freemium Split
- **Free:** treble-clef notes E4–F5, endless mode, score & streak.
- **Pro:** ledger-line notes (incl. middle C), bass clef, sharps/flats, extra game modes.
  One-time IAP, **no subscription**.

## Pricing — TBD
`PRICE` = **`$4.99` placeholder**. Kids' note-reading apps skew cheap and competitive; $2.99–$4.99
one-time is the likely range. A **studio/teacher license** (bulk unlock) is worth exploring given
the teacher channel. Research before launch. Update only the `PRICE` constant.

## Next Session Priorities
1. Bass clef mode + the Pro note pools wired through the gate.
2. Game modes (timed, lives, results screen) + kid reward animations.
3. Port the `IAP` module + trial from Jazz Guitar Lab.
4. App icons, Capacitor iOS project, `codemagic.yaml`.
5. **Teacher outreach kit** (printable + studio-license concept) — the growth lever.
6. Pricing research → set `PRICE`.
