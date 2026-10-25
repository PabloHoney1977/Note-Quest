# Note Quest — App Store submission kit

Everything to paste into App Store Connect, plus the remaining manual steps.

## Listing copy

**Name:** Note Quest: Read Music Notes
**Subtitle (30):** Note-reading game for kids
**Category:** Education (primary), Music (secondary) — **Kids category, Ages 6–8** (or 9–11; pick one band)
**Age rating:** 4+
**Price:** Free, with one non-consumable IAP (`note_quest_pro_unlock`). Set the price tier in App Store Connect;
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
**Copyright:** © 2026 Highland Music LLC

## App Privacy ("nutrition label")
The iOS build sends **no analytics** (`track()` is a no-op when native) and has no ads or accounts.
RevenueCat handles the purchase using an anonymous app user ID. Declare:
- **Purchases → Purchase History** — App Functionality, not linked to identity, not used for tracking.
- Everything else: **Not collected.**

Verify against RevenueCat's current App Privacy guidance before submitting.

## App Review notes (paste into "Notes")
> Kids-category app. Purchases, Restore, and the Privacy/Support links are behind a parental gate
> (a spelled-out multiplication question typed on a keypad). Pro is a single non-consumable
> unlock ("note_quest_pro_unlock"). No login is required. The app makes no network requests except to
> RevenueCat for the purchase.

## Screenshots needed
- iPhone 6.9" (1320×2868) — required.
- iPad 13" (2064×2752) — required, since the app runs on iPad.
Suggested shots: the staff + letter buttons; a streak confetti moment; the Instrument Workshop;
bass clef with a ledger note; the results screen.

## ✅ DECIDED 2026-10-24: ship in the Kids Category

Age band **6–8**, age rating **4+**, Education primary / Music secondary. This is a **one-way door** —
guideline 1.3: "once customers expect your app to follow the Kids Category requirements, it will need
to continue to meet these guidelines in subsequent updates, **even if you decide to deselect the
category**." Two standing consequences of this choice, both now enforced in code:

- **No analytics in this app, ever.** `track()` is a permanent no-op and the analytics key
  placeholder is gone from `index.html`; `test/shipping.test.cjs` fails if either comes back.
- **Cross-promotion to Archtone / Piano Chords Lab must sit behind the parental gate** (1.3 treats
  links out of the app as a distraction). The `Footer` gate pattern is the one to reuse. Note that the
  teacher channel — not cross-promo — is this app's stated growth lever, so this costs little here.

What the category requires (1.3 / 5.1.4), and where we stand:

| Requirement | Status |
|---|---|
| Purchases behind a parental gate | ✅ `ParentalGate` (spelled-out multiplication) |
| Links out of the app behind a parental gate | ✅ Privacy/Support links gated in `Footer` |
| No third-party analytics | ✅ `track()` no-ops natively, and **no PostHog script is ever loaded** |
| No third-party advertising | ✅ none |
| No PII/device info sent to third parties | ⚠️ **RevenueCat** — see below |
| Privacy policy covering children | ✅ rewritten 2026-10-24 (see below) |

**The one open risk — RevenueCat.** Kids Category apps "may not send personally identifiable
information or device information to third parties." RevenueCat is a third party and receives an
anonymous app user ID plus device/country metadata for the purchase. Plenty of Kids Category apps do
ship RevenueCat, and it is arguably a service provider for a purchase placed behind a parental gate —
but it is the one item that is not unambiguously clean. Options:
- **Ship as-is** (recommended): lowest effort, normal industry practice. If App Review objects, the
  fallback is below and costs one update.
- **Drop to StoreKit 2 directly** — no third party at all, fully clean, but a real rewrite of the
  `IAP` module and loses RevenueCat's receipt validation/restore plumbing.

**Because we ARE joining**, the listing copy below is good as written — guideline 2.3.8 *reserves*
"for kids"/"for children" wording for this category, so the subtitle "Note-reading game for kids" and
"Made for young musicians" are allowed here (and would have had to be rewritten otherwise).

## ✅ The business/account chain is DONE — none of it blocks Note Quest

Verified 2026-10-24 against the **Jazz Guitar App repo's CLAUDE.md**, which is the current source of
truth for portfolio status (the `highland-music-site` ops hub is stale — it still reads 2026-07-15 and
makes the EIN look like an open blocker; **it is not**):

- ✅ **Apple Developer account = Organization**, `Highland Music LLC` is the seller (2026-07-15).
- ✅ **EIN received** 2026-08-16.
- ✅ **LLC checking + W-9 + Paid Applications Agreement ACTIVE** (2026-08-24). Apple pays the LLC.
- ✅ **A sibling app has already shipped through App Review and is live** — Jazz Guitar Lab, rebranded
  **Archtone**, live since ~2026-09-20 with five 5★ reviews and a live `$14.99` `pro_unlock` IAP.

**So the whole hard part — account, entity, banking, agreements, and a proven Codemagic → TestFlight →
App Review path — is already behind us.** Note Quest's remaining work is per-app setup and clicking,
not structural. Still worth doing if not already: enroll in the **Apple Small Business Program**
(15% instead of 30%).

### Lessons already paid for on Archtone — apply them here
- **ITMS-90062/90186:** never upload a build whose `MARKETING_VERSION` matches an already-approved
  version. Note Quest is a brand-new app, so `1.0` is fine for the first train.
- **⛔ Never press "Remove from Review"** — it forfeits queue position entirely.
- **Submit `note_quest_pro_unlock` attached to the version**, not separately, or the app can be approved with a
  dead paywall.
- Expect a slow first review (new app + first IAP reviewed with the binary). Use "Manually release
  this version" so approval parks in *Pending Developer Release* instead of going live unwatched.
- Archtone's offline black-screen bug (CDN React → blank page with no network) was a real Guideline
  2.1 rejection risk. Note Quest already vendors React; the boot-safety net is now ported too (below).

## Still to do by hand
1. ~~**Privacy policy** covering children (COPPA).~~ ✅ **Rewritten 2026-10-24** in the
   `highland-music-site` repo (`privacy.html`): the old "not directed to children under 13" line is
   replaced with a Note-Quest-specific COPPA section (no PII collected, no analytics/ads/chat,
   on-device only, parental gate on purchases + outbound links, no verifiable-consent requirement
   because nothing is collected). **Edited locally but NOT yet committed/pushed — review and ship it,
   since the live URL is what App Review reads.**
2. ~~**Pricing:** pick the IAP price tier.~~ ✅ **Researched 2026-10-24 → `$4.99`** (CLAUDE.md →
   Pricing has the reasoning; Note Rush is $8.99 paid up front). `PRICE` in `app.js` is already
   $4.99 — just pick the matching tier in App Store Connect.
3. ~~**Confirm the bundle ID.**~~ ✅ **Decided 2026-10-24: `com.pablohoney.notequest`** — matches the
   portfolio convention and the already-live sibling (`com.pablohoney.jazzguitarlab`). Already applied
   to `capacitor.config.json`, `codemagic.yaml` (`BUNDLE_ID`) and `README.md`, and a test asserts the
   two stay in sync. **Register it in the Apple Developer portal, then in App Store Connect** create
   the app and the non-consumable IAP `note_quest_pro_unlock` — and submit the IAP *with* the first app version,
   not separately (Archtone's lesson: otherwise the app can be approved with a dead paywall).
## Walkthrough — what's reusable from Archtone vs. new for Note Quest

Archtone (Jazz Guitar Lab) is already live, so most of the plumbing exists. **Reuse, don't recreate:**

| Already set up (account-wide) | Status |
|---|---|
| Apple Developer Program, Organization = `Highland Music LLC` | ✅ reuse |
| Paid Applications Agreement, W-9, LLC banking | ✅ Active since 2026-08-24 |
| DSA trader declaration (27 countries) | ✅ Active — ⚠️ see EU note below |
| Small Business Program (15%) | submitted 2026-08-24 — **verify it was approved** |
| RevenueCat **account** | ✅ reuse (a new *app* inside it is needed) |
| Codemagic **account** + ASC API key integration `Codemagic CI` | ✅ reuse the integration as-is |
| 4 of the 5 `appstore_credentials` values | ✅ copy across unchanged |
| Sandbox tester Apple ID | ✅ reuse |
| `support@highlandmusicapps.com` forwarding | ✅ tested working |
| Screenshot tooling (playwright-core + installed Edge) | ✅ reuse the script pattern |

**New, per-app:** bundle id registration · App Store Connect app record · Note Quest's own
`note_quest_pro_unlock` IAP · a RevenueCat **app + `appl_` key** (keys are per-app) · a Codemagic application
and its two variable groups · screenshots · the IAP review screenshot.

### Step 1 — Publish the privacy policy ✅ DONE 2026-10-24
`privacy.html` in the `highland-music-site` repo said all the apps are "not directed to children
under 13", which contradicts a Kids Category submission. Rewritten with a Note-Quest-specific COPPA
section and **pushed — verified live** at `https://highlandmusicapps.com/privacy.html` (commit
`aed0983`). Jazz Guitar Lab and Piano Chords Lab keep the general-audience wording, which is still
accurate for them.

### Step 2 — Register the bundle id
developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → **+** → App IDs → App.
Description "Note Quest", Bundle ID **explicit** `com.pablohoney.notequest`. Capabilities: **leave
everything off** — the app needs none (no push, no iCloud, no sign-in). In-App Purchase is on by
default and needs no capability toggle.

### Step 3 — Create the App Store Connect app record
My Apps → **+** → New App. Platform iOS · Name **Note Quest: Read Music Notes** · Primary language
English (U.S.) · Bundle ID `com.pablohoney.notequest` · SKU `notequest-ios` (internal only).
Then on the version page set, from the **Listing copy** section above: subtitle, promo text,
description, keywords, Support + Privacy URLs, copyright.
- **Category:** Education (primary), Music (secondary).
- **Kids Category + age band 6–8** — set under the age rating questionnaire. Answer every content
  question "None"; the app has no violence, no web access, no user content, no chat.
- **Age rating:** 4+.
- **Price:** app itself **Free**.
- **Content Rights:** "Does not contain, show, or access third-party content" — unlike Archtone,
  Note Quest ships **no** sampled audio (it synthesizes tones in `tone()`), so this answer differs.
- **App Privacy:** declare **Purchases → Purchase History** only (App Functionality, not linked to
  identity, not used for tracking), everything else **Not collected**. There is no analytics in this
  app at all, so unlike Archtone there is nothing else to declare.
- ⚠️ **Select "Manually release this version"** at submission, or it goes live unwatched.
- ⚠️ **EU availability:** the DSA trader address is still the **home address** and is D&B-locked, so
  it would display publicly on EU store pages. Either fix it at Dun & Bradstreet first
  (`iupdate.dnb.com`, free, ~a month to propagate) **or launch US-only and add the EU later.**
- Note the app's **numeric Apple ID** from App Information — Step 6 needs it.

### Step 4 — Create the IAP ✅ created 2026-10-24
Monetization → In-App Purchases → **+** → **Non-Consumable**.
Reference name "Note Quest Pro" · Product ID **`note_quest_pro_unlock`** · price **$4.99** tier.

**Localization** (customer-facing; the buyer is a *parent*, past the parental gate):

| Field | Value | Limit |
|---|---|---|
| Display Name | `Note Quest Pro` | 30 chars (uses 14) |
| Description | `Bass clef, middle C, sharps and game modes` | 45 chars (uses 42) |

"Middle C" is deliberate — it's the phrase that reads to parents and piano teachers, and it signals
the tier of material. Alternate if you'd rather be musically precise:
`Bass clef, ledger notes, sharps & modes` (39). Don't spend characters on "one-time" or "no
subscription"; the **Non-Consumable** type already says that in the store UI. Keep the description
covering the same four things the in-app paywall promises — App Review compares them.

**Required review screenshot of the paywall:**

> `C:\Users\pehre\Downloads\NoteQuest-AppStore-Screenshots\iPhone-6.9\6-paywall.png`

⚠️ Until the localization, price **and** screenshot are all in, the IAP sits at **"Missing Metadata"**
and RevenueCat shows that same status — which also means **sandbox purchases will fail**. It needs to
reach **"Ready to Submit"** (not Approved) before Step 9 can work.

⚠️ **The product id is `note_quest_pro_unlock`, NOT `pro_unlock` — do not "fix" it back.** Product
IDs are unique across the whole developer account and Archtone already owns `pro_unlock`. `app.js`
sets `IAP.PRODUCT` to the namespaced id and a test asserts it, so the code, this file and App Store
Connect stay in step. (The *entitlement* is still plain `pro` — that's a separate RevenueCat concept
and is per-project, so it doesn't collide.)
⚠️ **Attach the IAP to the first version's submission.** If it goes separately the app can be approved
with a dead paywall (Archtone's lesson).

### Step 5 — RevenueCat: a new app in the existing account
Keys are per-app, so Archtone's `appl_` key will **not** work here. Create a **new project**
"Note Quest" (cleaner than adding an app to Archtone's project — entitlements and offerings are
project-scoped). Then, in order:

1. Add an **App Store** app, bundle id `com.pablohoney.notequest`. This screen also asks for an
   **App Store Connect API** key — **click "Select existing key"** and pick the one already uploaded
   for Archtone; RevenueCat keeps these on the account, so there is nothing to recreate.
   Only if that list is empty, use **"Add new key"**, which needs a `.p8` from
   ASC → Users and Access → Integrations → **In-App Purchase** (or an ASC API Team Key with
   Admin/App Manager role). That `.p8` downloads **once only** — if it's lost, just generate a fresh
   key. Never commit it.
   The key is strictly optional (it's what imports `note_quest_pro_unlock` and syncs its price
   automatically instead of you typing the product in), so a missing key doesn't block you.
   ⚠️ **The entitlement is NOT on this screen** — that's the next sub-step, in a different section.
2. **Project → Product catalog → Entitlements → + New.**
   ⚠️ **Create the entitlement with identifier exactly `pro`** — lowercase, no spaces.
   **RevenueCat fixes entitlement identifiers at creation and they cannot be renamed.** This went
   wrong on Archtone — it was first created as the company name followed by "Pro", and recovery meant
   detaching every associated product, deleting the entitlement, then recreating it. `app.js`
   hardcodes `IAP.ENTITLEMENT = 'pro'`, so anything else silently never grants Pro.
3. Add product **`note_quest_pro_unlock`** and attach it to `pro`.
4. Create an offering, mark it **Current**, with a **Lifetime** package holding `note_quest_pro_unlock`.
   RevenueCat pre-fills a new offering with **three packages** (`$rc_monthly`, `$rc_annual`,
   `$rc_lifetime`), each wired only to its **Test Store** demo product and showing **"No product"**
   for the App Store app. ⚠️ **Set the "Note Quest (App Store)" dropdown on `$rc_lifetime` to
   `note_quest_pro_unlock`** — until you do, the offering contains nothing for iOS at all.
   Then **delete `$rc_monthly` and `$rc_annual`**: not because they break anything (RevenueCat omits
   product-less packages from `availablePackages` on device, and `_package()` finds by identifier
   anyway) but because this app has no subscriptions, and subscription shells in the Current offering
   mislead anyone reading it later. The `test_` products are inert on iOS; clear them or don't.
   The offering's identifier (`default`) is irrelevant and its "cannot be changed later" warning
   doesn't bite — `app.js` reads `offerings.current`, never an offering by name. **Being Current is
   the only thing that matters.**
   ⚠️ **"Current" is not a field on the offering's own page** — it's a badge on the
   **Product catalog → Offerings list**, changed from the row there. The first offering you create
   becomes Current automatically, so usually there is nothing to click; just confirm the badge is on
   `default` and not on a leftover Test Store offering. The real proof is the TestFlight build: if
   the paywall button reads "Unlock Pro — $4.99", `offerings.current` resolved correctly; a bare
   "Unlock Pro" means it didn't.
   ⚠️ **Don't skip this because purchases seem to work without it.** `IAP._package()` reads
   `offerings.current.availablePackages`; with no current offering it returns null, so `IAP.price`
   is never set and the paywall button renders as bare **"Unlock Pro"** with no price. The purchase
   still succeeds via the `purchaseStoreProduct` fallback, so this fails *quietly* — a working
   button with a missing price is exactly the kind of thing that reaches review unnoticed.
5. Copy the **public iOS SDK key** (`appl_…`) for Step 6. ⚠️ Onboarding also creates a **Test Store**
   with demo Monthly/Yearly/Lifetime products and a **`test_…`** key — **ignore the test key**; only
   the `appl_…` key from the App Store app works on device.

Two things that are *easier* here than on Archtone: the IAP only needs status **"Ready to Submit"**
(not Approved) for RevenueCat to sync and for sandbox purchases to work — Apple reviews it with the
first app submission. And Note Quest's `_package()` looks the package up **by product identifier**
rather than taking `availablePackages[0]`, so leftover empty package shells can't break the purchase.

### Step 6 — Codemagic
Add the `Note-Quest` repo as an application. Then App settings → Environment variables, creating two
groups (names must match `codemagic.yaml` exactly):
- **`appstore_credentials`** — all marked **Secure**:
  `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_KEY_IDENTIFIER`, `APP_STORE_CONNECT_PRIVATE_KEY`,
  `CERTIFICATE_PRIVATE_KEY`, plus `APP_STORE_APPLE_ID` → **Note Quest's** numeric Apple ID
  (ASC → the app → App Information → Apple ID). That last one is **per-app**; using Archtone's would
  read build numbers off the wrong app.

  ⚠️ **"Copy them from Archtone" may not be literally possible — Codemagic Secure variables are
  write-only and cannot be read back.** Check **Team settings → Global variables and secrets** first:
  if the group lives there, this app inherits it and there is nothing to re-enter. If it was created
  per-app on Archtone, re-source the values instead:
  - *Issuer ID* and *Key ID* — re-readable any time at ASC → Users and Access → Integrations.
  - *`APP_STORE_CONNECT_PRIVATE_KEY`* — the saved `.p8`; if lost, generate a new ASC API key, which
    costs nothing.
  - *`CERTIFICATE_PRIVATE_KEY`* — **worth hunting for.** Reusing the same RSA key makes
    `fetch-signing-files --create` regenerate the *same* distribution certificate; a fresh key
    creates a *second* one, and Apple caps how many you can hold. Not fatal (there's room for one
    more alongside Archtone's) but avoidable churn.
- **`revenuecat`** — `RC_IOS_KEY` = the `appl_…` key from Step 5. The build **fails loudly** without
  it rather than shipping an app whose purchases can't work.

The App Store Connect integration `Codemagic CI` is already on the account — just make sure this app
can see it. `RC_IOS_KEY` is a *publishable* client key, so marking it Secure is optional; the
`appstore_credentials` five are genuine secrets and must all be Secure.

Then run the **`ios-release`** workflow by hand from the dashboard ("Start new build"). Unlike
Archtone there is **no push trigger**, so landing on `main` will *not* start an iOS build — that's
deliberate (main is also the web/Pages branch). Nobody can kick off a build from a Claude session
either: there's no Codemagic API token in this environment, so builds and their status are dashboard-only.

**Expect the first build to need a nudge** — `ios/` is generated in CI, so this is the first time Note
Quest has ever compiled for iOS. The config already encodes every failure Archtone hit (SPM not
CocoaPods, manual signing with `--create`, explicit package resolution), so the likely remaining
surprises are the `sharp` native install for icon generation and first-run certificate creation.

### Step 7 — Verify the build on TestFlight
Install from TestFlight and check: the **icon is the real Note Quest icon** (not Capacitor's
placeholder), the app **boots with the device in airplane mode** (it must — React is vendored and
there are no network calls), the parental gate appears before purchase and before the Privacy/Support
links, and the staff renders correctly on **iPad** as well as iPhone.

### Step 8 — Screenshots ✅ DONE 2026-10-24
**12 PNGs, all at Apple's exact required sizes**, in
`~/Downloads/NoteQuest-AppStore-Screenshots/{iPhone-6.9,iPad-13}/`:

| # | Shot | What it shows |
|---|---|---|
| 1 | `gameplay` | the staff + letter keypad mid-run — score 36, streak 3, best 24 |
| 2 | `streak` | the milestone celebration: confetti mid-fall, 🎵 "On fire! 5 streak!" |
| 3 | `workshop` | a part-built guitar with its progress bar + a shelf of 3 finished instruments |
| 4 | `bassclef` | bass clef showing **middle C on its ledger line** |
| 5 | `results` | end of a Lives run — 112, 7/10, 70%, best streak 7, sticker shelf |
| 6 | `paywall` | **this is the IAP review screenshot for Step 4** — real "Unlock Pro — $4.99" + Restore |

Upload 1–5 as the store screenshots (Apple's page is by device type; iPhone 6.9" and iPad 13" are
the two required). Use **6** as the IAP review screenshot, not as a store screenshot.

Regenerate any time with `npm i -D playwright-core && node scripts/shoot-screenshots.cjs` — it
renders from the repo itself (no device, no simulator, no Mac) by driving installed Edge, presets
state through `localStorage`, plays the game by reading each note off the staff SVG, and verifies
every PNG is exactly the required pixel size. Note Quest opens **light**, so the set is light
(Archtone's is dark — don't copy that choice across).

### Step 9 — Sandbox purchase test
On device, signed into the sandbox Apple ID: buy `note_quest_pro_unlock`, confirm Pro unlocks, delete and
reinstall, then confirm **Restore purchase** brings it back. Both paths sit behind the parental gate.

### Step 10 — Submit
Attach the build, confirm the IAP is attached to the version, "Manually release this version", submit.
Then: **⛔ never press "Remove from Review"** — it forfeits queue position. Expect a slow first review
(new app + first IAP reviewed with the binary). Watch Resolution Center *and* the Gmail spam folder;
an information request stalls silently and looks identical to a long queue.
After approval, buy it once with a **real card** — sandbox is not production.
