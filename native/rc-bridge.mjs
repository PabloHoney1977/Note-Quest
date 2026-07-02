/* Native-only RevenueCat bridge.
 * esbuild bundles this into www/native.js, which the build injects into the Capacitor copy of
 * index.html (see scripts/prepare-www.mjs). It is NOT part of the GitHub Pages build — on the web
 * the IAP module falls back to a local unlock. Here it exposes the plugin + public SDK key on
 * window so app.js's IAP module can drive real StoreKit purchases. */
import { Capacitor } from '@capacitor/core';
import { Purchases } from '@revenuecat/purchases-capacitor';

// RC_IOS_KEY is replaced at build time by esbuild --define (from the RC_IOS_KEY env var).
// The typeof guard keeps this safe if the define is omitted (dev builds).
const KEY = (typeof RC_IOS_KEY !== 'undefined') ? RC_IOS_KEY : '';

if (Capacitor.isNativePlatform()) {
  window.Purchases = Purchases;
  if (KEY) window.__RC_KEY__ = KEY;
}
