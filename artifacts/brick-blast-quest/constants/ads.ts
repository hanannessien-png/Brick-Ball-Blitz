/**
 * Real AdMob IDs (production).
 *
 * These are wired for the production build with react-native-google-mobile-ads
 * (see context/AdContext.tsx header + PUBLISHING.md). They do NOT load in
 * Expo Go / web preview — ads there are simulated.
 *
 * The Android App ID must also match the one registered in app.json under the
 * react-native-google-mobile-ads plugin config.
 */
export const ADMOB = {
  androidAppId: 'ca-app-pub-6225158226956884~6953177308',
  appOpen: 'ca-app-pub-6225158226956884/1683317561',
  interstitial: 'ca-app-pub-6225158226956884/9785168868',
  rewarded: 'ca-app-pub-6225158226956884/2710679966',
  banner: 'ca-app-pub-6225158226956884/4135442274',
} as const;

/**
 * Google's official TEST unit IDs — use these while testing on a real device
 * so the AdMob account never gets flagged for invalid traffic. Switch to the
 * real ADMOB ids only for the release build uploaded to Google Play.
 */
export const ADMOB_TEST = {
  appOpen: 'ca-app-pub-3940256099942544/9257395921',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
  banner: 'ca-app-pub-3940256099942544/6300978111',
} as const;
