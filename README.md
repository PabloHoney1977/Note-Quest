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
Single-file React 18 PWA (CDN React, no bundler). All logic in `app.js` (`e()` = `React.createElement`). CSS theme vars in `index.html`. Capacitor iOS + Codemagic to be added (mirror Jazz Guitar Lab).

## Roadmap (MVP → launch)
- [ ] Bass clef mode (Pro)
- [ ] Sharps/flats and key signatures (Pro)
- [ ] "Beat the clock" + "lives" game modes; win/results screen
- [ ] Sticker/badge rewards, level progression (kid retention)
- [ ] Optional MIDI/mic input ("play the note" instead of tapping the letter)
- [ ] Real instrument samples (port from Jazz Guitar Lab)
- [ ] RevenueCat IAP (port the `IAP` module)
- [ ] App icons, Capacitor iOS project, `codemagic.yaml`
- [ ] Pricing decision (`$4.99` placeholder in `app.js` `PRICE`)
- [ ] **Teacher outreach kit** — the real growth lever (printable, studio-license idea)

## Freemium split
- **Free:** treble-clef notes on the staff (E4–F5), endless mode, score & streak.
- **Pro:** ledger-line notes (incl. middle C), bass clef, sharps/flats, extra game modes. One-time IAP.
