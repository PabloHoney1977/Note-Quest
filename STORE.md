# Note Quest — App Store submission kit

Everything to paste into App Store Connect, plus the remaining manual steps.

## Listing copy

**Name:** Note Quest: Read Music Notes
**Subtitle (30):** Note-reading game for kids
**Category:** Education (primary), Music (secondary) — **Kids category, Ages 6–8** (or 9–11; pick one band)
**Age rating:** 4+
**Price:** Free, with one non-consumable IAP (`pro_unlock`). Set the price tier in App Store Connect;
the app shows the store's localized price automatically.

**Promotional text (170):**
Learn to read music one note at a time! Build streaks, earn stickers, and craft your own instruments as you play.

**Description:**
Note Quest turns reading music into a game kids actually want to play.

A note appears on the staff — tap its letter name. Get it right to build your streak, fill the
confetti meter, and collect stickers. Every correct answer also helps you build your very own
instrument in the Instrument Workshop: choose a guitar, violin or banjo, pick its shape, color and
strings, then tap to play it!

FREE
• Treble-clef notes on the staff
• Endless mode with score, streak and best score
• Sticker rewards and the Instrument Workshop

NOTE QUEST PRO (one-time purchase — no subscription)
• Bass clef, and treble + bass mixed
• Ledger-line notes, including middle C
• Sharps & flats
• Timed (60-second) and Lives game modes

Made for young musicians, piano students and their teachers. No ads. No accounts. No tracking.

**Keywords (100):**
note,reading,music,kids,piano,sight,treble,bass,clef,staff,flashcards,theory,lesson,teacher,game

**Support URL:** https://highlandmusicapps.com/support.html
**Privacy Policy URL:** https://highlandmusicapps.com/privacy.html
**Copyright:** © 2026 Highland Music, LLC

## App Privacy ("nutrition label")
The iOS build sends **no analytics** (`track()` is a no-op when native) and has no ads or accounts.
RevenueCat handles the purchase using an anonymous app user ID. Declare:
- **Purchases → Purchase History** — App Functionality, not linked to identity, not used for tracking.
- Everything else: **Not collected.**

Verify against RevenueCat's current App Privacy guidance before submitting.

## App Review notes (paste into "Notes")
> Kids-category app. Purchases, Restore, and the Privacy/Support links are behind a parental gate
> (a spelled-out multiplication question typed on a keypad). Pro is a single non-consumable
> unlock ("pro_unlock"). No login is required. The app makes no network requests except to
> RevenueCat for the purchase.

## Screenshots needed
- iPhone 6.9" (1320×2868) — required.
- iPad 13" (2064×2752) — required, since the app runs on iPad.
Suggested shots: the staff + letter buttons; a streak confetti moment; the Instrument Workshop;
bass clef with a ledger note; the results screen.

## Still to do by hand
1. **Privacy policy:** it currently says the apps are "not directed to under-13". Kids-category
   apps must have a policy that covers children (COPPA). Update the site before submitting.
2. **Pricing:** pick the IAP price tier (see CLAUDE.md → Pricing). Also update `PRICE` in `app.js`,
   which is only the fallback label on the web build.
3. **App Store Connect:** create the app (bundle `com.musicappstudio.notequest`) and the
   non-consumable IAP `pro_unlock`. Submit the IAP *with* the first app version.
4. **RevenueCat:** create the project, attach `pro_unlock` to the entitlement `pro` and the current
   offering, and put the public iOS key in the Codemagic `revenuecat` group as `RC_IOS_KEY`.
   The CI build now fails if the key is missing.
5. **Codemagic:** connect the App Store Connect API key as `CodemagicASC`, then run `ios-release`.
6. **TestFlight:** test purchase and restore with a Sandbox account, on both iPhone and iPad.
