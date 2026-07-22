/**
 * Web / typecheck fallback for the Google Mobile Ads SDK.
 *
 * Metro resolves `gma.native.ts` on Android/iOS (real SDK, guarded require)
 * and this file on web, where the native SDK can never load. Keeping the
 * import out of the web bundle entirely is required — Metro refuses to bundle
 * react-native internals for web even behind runtime guards.
 */
export type GmaModule = typeof import('react-native-google-mobile-ads');

export const GMA: GmaModule | null = null;
