/**
 * Native (Android/iOS) loader for the Google Mobile Ads SDK.
 *
 * - Real build (EAS APK/AAB, dev client): require succeeds → GMA is the SDK.
 * - Expo Go: the native module is missing → require throws → GMA is null and
 *   the app falls back to the simulated ad layer.
 */
export type GmaModule = typeof import('react-native-google-mobile-ads');

let mod: GmaModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const m = require('react-native-google-mobile-ads') as GmaModule;
  // Touching a native-backed export throws in Expo Go → falls to catch.
  void m.default();
  mod = m;
} catch {
  mod = null;
}

export const GMA = mod;
