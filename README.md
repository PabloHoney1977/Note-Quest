# Note Quest

A fun, fast **music note-reading game** for kids and beginners — read the note on the staff, tap its letter, build a streak. Part of the music-app studio alongside [Jazz Guitar Lab](https://github.com/PabloHoney1977/Jazz-Guitar-App) and [Piano Chords Lab](https://github.com/PabloHoney1977/Piano-Chords-Lab).

**Why this app:** the discovery channel is uniquely organic — piano/music teachers recommend note-reading apps to their *entire studio* (see how "Note Rush" spread). That word-of-mouth beats paid acquisition, which is the ceiling on the other apps.

## Status
🌱 **Starter scaffold.** A complete, playable treble-clef loop: random note on a real SVG staff, 7 answer buttons (C–B), score/streak/best with `localStorage` persistence, audio feedback, correct/wrong flash, dark/light theme, and the freemium gate (treble-staff notes free; ledger lines, middle C, bass clef & sharps behind Pro).

## Run locally
No build step (service worker needs http, not `file://`):
```
python -m http.server 8000
# open http://localhost:8000
```
Live (GitHub Pages, served from `main`): https://pablohoney1977.github.io/Note-Quest/

## Stack
Single-file React 18 PWA (CDN React, no bundler). All logic in `app.js` (`e()` = `React.createElement`). CSS theme vars in `index.html`. Capacitor iOS + Codemagic wired (see **Native iOS** below); only the native RevenueCat bridge is bundled (esbuild) — the web app stays build-free.

## Roadmap (MVP → launch)
- [x] Bass clef mode (Pro)
- [x] Sharps/flats (Pro) — key signatures still to come
- [x] "Beat the clock" + "lives" game modes; results screen
- [x] Sticker/badge rewards (streak-milestone confetti + collectible shelf)
- [ ] Optional MIDI/mic input ("play the note" instead of tapping the letter)
- [ ] Real instrument samples (port from Jazz Guitar Lab)
- [x] RevenueCat IAP (`IAP` module — native + web fallback)
- [x] App icons, Capacitor iOS project, `codemagic.yaml`
- [ ] Pricing decision (`$4.99` placeholder in `app.js` `PRICE`)
- [ ] **Teacher outreach kit** — the real growth lever (printable, studio-license idea)

## Freemium split
- **Free:** treble-clef notes on the staff (E4–F5), endless mode, score & streak.
- **Pro:** ledger-line notes (incl. middle C), bass clef, sharps/flats, extra game modes. One-time IAP.

## Native iOS (Capacitor)
The web app is the source of truth; Capacitor wraps it for the App Store.

```
npm ci
RC_IOS_KEY=appl_xxx npm run build   # stage www/ + bundle native RevenueCat bridge
npx cap add ios                     # first time only (generates ios/)
npm run assets                      # app icons/splash from assets/icon.png (needs sharp/network)
npx cap sync ios                    # copy web assets + install pods
npx cap open ios                    # open in Xcode
```

- **`webDir` is `www/`** (built by `scripts/prepare-www.mjs`) — the Pages build still serves the repo
  root directly and never sees `www/`.
- **RevenueCat:** `native/rc-bridge.mjs` is bundled into `www/native.js` (native only) and assigns
  `window.Purchases` + `window.__RC_KEY__` (embedded from `RC_IOS_KEY`). On the web there's no store,
  so the `IAP` module falls back to a local unlock. Bundle id: `com.musicappstudio.notequest`.
- **CI:** `codemagic.yaml` runs the build, generates the iOS project, syncs, and ships to TestFlight.
  Configure the `revenuecat` env group (`RC_IOS_KEY`) and an App Store Connect integration first.
- **Icons:** source is `assets/icon.svg`/`assets/icon.png`; PWA PNGs live in `icons/`.
