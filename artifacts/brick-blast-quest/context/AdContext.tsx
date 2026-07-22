/**
 * Ads layer for Brick Blast Quest — PRODUCTION READY.
 *
 * HOW IT WORKS (automatic, no code changes needed):
 * - In a real build (EAS APK/AAB or dev client), the Google Mobile Ads SDK is
 *   available → REAL AdMob ads are shown.
 *     - Debug/dev builds automatically use Google's TEST unit ids (ADMOB_TEST)
 *       so the AdMob account is never flagged for invalid traffic.
 *     - Release builds (the one you upload to Google Play) automatically use
 *       the REAL unit ids from constants/ads.ts (ADMOB).
 * - In Expo Go / web preview the native SDK cannot load → a simulated ad layer
 *   with the same API is used, so the game stays fully playable in preview.
 *
 * The AdMob App ID is registered in app.json under the
 * react-native-google-mobile-ads plugin. All unit ids live in constants/ads.ts.
 *
 * Policy notes baked into this design:
 * - Interstitials only between games (never during gameplay), every N games.
 * - Rewarded ads are always optional and user-initiated.
 * - Banner only on menu screens, never on the gameplay screen.
 * - EU consent (UMP) is requested before ads initialize when required.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { INTERSTITIAL_EVERY_N_GAMES } from '@/constants/game';
import { ADMOB, ADMOB_TEST } from '@/constants/ads';
// Platform-split loader: real SDK on native builds, null on web/Expo Go.
// (Metro picks gma.native.ts on Android/iOS and gma.ts on web.)
import { GMA, type GmaModule } from '@/context/gma';

/**
 * Unit ids: Google TEST ids in debug builds AND in the EAS "preview" APK
 * (EXPO_PUBLIC_USE_TEST_ADS=1 is set in eas.json), so testing on your own
 * phone never risks the AdMob account. Only the "production" AAB uploaded to
 * Google Play uses the real ids.
 */
const USE_TEST_ADS = __DEV__ || process.env.EXPO_PUBLIC_USE_TEST_ADS === '1';
const UNITS = USE_TEST_ADS ? ADMOB_TEST : ADMOB;

// ---------------------------------------------------------------------------
// Shared context
// ---------------------------------------------------------------------------
interface AdContextValue {
  /** Shows a rewarded ad. Resolves true when the user earned the reward. */
  showRewardedAd: () => Promise<boolean>;
  /** Call after each finished game; shows an interstitial every N games. */
  maybeShowInterstitial: () => Promise<void>;
  adVisible: boolean;
}

const AdContext = createContext<AdContextValue | null>(null);

export function useAds(): AdContextValue {
  const ctx = useContext(AdContext);
  if (!ctx) throw new Error('useAds must be used within AdProvider');
  return ctx;
}

export function AdProvider({ children }: { children: React.ReactNode }) {
  return GMA ? (
    <NativeAdProvider>{children}</NativeAdProvider>
  ) : (
    <SimulatedAdProvider>{children}</SimulatedAdProvider>
  );
}

// ---------------------------------------------------------------------------
// REAL AdMob provider (used automatically in APK/AAB builds)
// ---------------------------------------------------------------------------
function NativeAdProvider({ children }: { children: React.ReactNode }) {
  const gma = GMA as GmaModule;
  const [adVisible, setAdVisible] = useState(false);
  const gamesSinceAd = useRef(0);

  // Consent (UMP) → initialize → App Open ad on launch.
  useEffect(() => {
    let cancelled = false;
    const unsubs: Array<() => void> = [];
    (async () => {
      try {
        const consent = await gma.AdsConsent.requestInfoUpdate();
        if (
          consent.isConsentFormAvailable &&
          consent.status === gma.AdsConsentStatus.REQUIRED
        ) {
          await gma.AdsConsent.showForm();
        }
      } catch {
        // Consent unavailable (e.g. no network) — continue; SDK handles NPA.
      }
      try {
        await gma.default().initialize();
      } catch {
        return;
      }
      if (cancelled) return;
      // App Open ad shortly after launch. Listeners are registered in the
      // outer `unsubs` array so the real effect cleanup below removes them.
      try {
        const appOpen = gma.AppOpenAd.createForAdRequest(UNITS.appOpen, {
          requestNonPersonalizedAdsOnly: false,
        });
        unsubs.push(
          appOpen.addAdEventListener(gma.AdEventType.LOADED, () => {
            if (cancelled) return;
            setAdVisible(true);
            appOpen.show().catch(() => {
              if (!cancelled) setAdVisible(false);
            });
          }),
        );
        unsubs.push(
          appOpen.addAdEventListener(gma.AdEventType.CLOSED, () => {
            if (!cancelled) setAdVisible(false);
          }),
        );
        unsubs.push(
          appOpen.addAdEventListener(gma.AdEventType.ERROR, () => {
            if (!cancelled) setAdVisible(false);
          }),
        );
        appOpen.load();
      } catch {
        // No fill / error — game continues normally.
      }
    })();
    return () => {
      cancelled = true;
      for (const u of unsubs) {
        try {
          u();
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showRewardedAd = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      let earned = false;
      let settled = false;
      let shown = false;
      let loadTimer: ReturnType<typeof setTimeout> | null = null;
      const unsubs: Array<() => void> = [];
      const settle = (v: boolean) => {
        if (settled) return;
        settled = true;
        if (loadTimer) clearTimeout(loadTimer);
        for (const u of unsubs) {
          try {
            u();
          } catch {}
        }
        setAdVisible(false);
        resolve(v);
      };
      try {
        const ad = gma.RewardedAd.createForAdRequest(UNITS.rewarded, {
          requestNonPersonalizedAdsOnly: false,
        });
        unsubs.push(
          ad.addAdEventListener(gma.RewardedAdEventType.LOADED, () => {
            shown = true;
            if (loadTimer) {
              clearTimeout(loadTimer);
              loadTimer = null;
            }
            setAdVisible(true);
            ad.show().catch(() => settle(false));
          }),
        );
        unsubs.push(
          ad.addAdEventListener(gma.RewardedAdEventType.EARNED_REWARD, () => {
            earned = true;
          }),
        );
        unsubs.push(ad.addAdEventListener(gma.AdEventType.CLOSED, () => settle(earned)));
        unsubs.push(ad.addAdEventListener(gma.AdEventType.ERROR, () => settle(false)));
        ad.load();
        // Timeout covers ONLY the load phase (no fill / dead network). Once
        // the ad is showing, the user can watch as long as the video runs.
        loadTimer = setTimeout(() => {
          if (!shown) settle(false);
        }, 15000);
      } catch {
        settle(false);
      }
    });
  }, [gma]);

  const maybeShowInterstitial = useCallback(async (): Promise<void> => {
    gamesSinceAd.current += 1;
    if (gamesSinceAd.current < INTERSTITIAL_EVERY_N_GAMES) return;
    gamesSinceAd.current = 0;
    await new Promise<void>((resolve) => {
      let settled = false;
      let shown = false;
      let loadTimer: ReturnType<typeof setTimeout> | null = null;
      const unsubs: Array<() => void> = [];
      const settle = () => {
        if (settled) return;
        settled = true;
        if (loadTimer) clearTimeout(loadTimer);
        for (const u of unsubs) {
          try {
            u();
          } catch {}
        }
        setAdVisible(false);
        resolve();
      };
      try {
        const ad = gma.InterstitialAd.createForAdRequest(UNITS.interstitial, {
          requestNonPersonalizedAdsOnly: false,
        });
        unsubs.push(
          ad.addAdEventListener(gma.AdEventType.LOADED, () => {
            shown = true;
            if (loadTimer) {
              clearTimeout(loadTimer);
              loadTimer = null;
            }
            setAdVisible(true);
            ad.show().catch(settle);
          }),
        );
        unsubs.push(ad.addAdEventListener(gma.AdEventType.CLOSED, settle));
        unsubs.push(ad.addAdEventListener(gma.AdEventType.ERROR, settle));
        ad.load();
        // Load-phase timeout only — never cuts off a showing ad.
        loadTimer = setTimeout(() => {
          if (!shown) settle();
        }, 12000);
      } catch {
        settle();
      }
    });
  }, [gma]);

  return (
    <AdContext.Provider value={{ showRewardedAd, maybeShowInterstitial, adVisible }}>
      {children}
    </AdContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Simulated provider (Expo Go / web preview only)
// ---------------------------------------------------------------------------
type AdKind = 'rewarded' | 'interstitial' | 'appopen';

const AD_DURATION: Record<AdKind, number> = {
  rewarded: 5,
  interstitial: 3,
  appopen: 2,
};

function SimulatedAdProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [kind, setKind] = useState<AdKind>('rewarded');
  const [remaining, setRemaining] = useState(0);
  const resolver = useRef<((earned: boolean) => void) | null>(null);
  const gamesSinceAd = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const openAd = useCallback((k: AdKind): Promise<boolean> => {
    return new Promise((resolve) => {
      resolver.current = resolve;
      setKind(k);
      setRemaining(AD_DURATION[k]);
      setVisible(true);
    });
  }, []);

  useEffect(() => {
    if (!visible) return;
    timer.current = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [visible]);

  // App Open ad on launch (static-image style, short)
  useEffect(() => {
    const t = setTimeout(() => {
      openAd('appopen');
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = useCallback((earned: boolean) => {
    setVisible(false);
    resolver.current?.(earned);
    resolver.current = null;
  }, []);

  const showRewardedAd = useCallback(() => openAd('rewarded'), [openAd]);

  const maybeShowInterstitial = useCallback(async () => {
    gamesSinceAd.current += 1;
    if (gamesSinceAd.current >= INTERSTITIAL_EVERY_N_GAMES) {
      gamesSinceAd.current = 0;
      await openAd('interstitial');
    }
  }, [openAd]);

  return (
    <AdContext.Provider value={{ showRewardedAd, maybeShowInterstitial, adVisible: visible }}>
      {children}
      <AdOverlay visible={visible} kind={kind} remaining={remaining} onClose={close} />
    </AdContext.Provider>
  );
}

function AdOverlay({
  visible,
  kind,
  remaining,
  onClose,
}: {
  visible: boolean;
  kind: AdKind;
  remaining: number;
  onClose: (earned: boolean) => void;
}) {
  const colors = useColors();
  const done = remaining <= 0;
  const isRewarded = kind === 'rewarded';

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={() => {}}>
      <View style={[styles.adRoot, { backgroundColor: '#05060f' }]}>
        <View style={styles.adBadge}>
          <Text style={styles.adBadgeText}>TEST AD</Text>
        </View>
        <Feather name="play-circle" size={72} color={colors.primary} />
        <Text style={[styles.adTitle, { color: colors.foreground }]}>
          {kind === 'appopen' ? 'Welcome back!' : isRewarded ? 'Reward Video' : 'Advertisement'}
        </Text>
        <Text style={[styles.adSub, { color: colors.mutedForeground }]}>
          Simulated {kind === 'appopen' ? 'App Open' : isRewarded ? 'Rewarded' : 'Interstitial'} ad
          {'\n'}Real AdMob ads appear automatically in the APK/AAB build
        </Text>
        {done ? (
          <Pressable
            testID="ad-close"
            onPress={() => onClose(true)}
            style={[styles.adBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name={isRewarded ? 'gift' : 'x'} size={18} color="#04121a" />
            <Text style={styles.adBtnText}>{isRewarded ? 'Claim Reward' : 'Close'}</Text>
          </Pressable>
        ) : (
          <View style={[styles.countdown, { borderColor: colors.border }]}>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }}>
              {remaining}s
            </Text>
          </View>
        )}
        {isRewarded && !done ? (
          <Pressable onPress={() => onClose(false)} style={styles.skipLink} testID="ad-skip">
            <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
              Cancel (no reward)
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  adRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  adBadge: {
    position: 'absolute',
    top: 70,
    left: 24,
    backgroundColor: '#ffd60a',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  adBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#111' },
  adTitle: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  adSub: { textAlign: 'center', fontSize: 14, lineHeight: 20 },
  adBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
    marginTop: 12,
  },
  adBtnText: { fontFamily: 'Inter_700Bold', color: '#04121a', fontSize: 16 },
  countdown: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  skipLink: { marginTop: 8, padding: 8 },
});

// ---------------------------------------------------------------------------
// Banner — real BannerAd in builds, placeholder in preview. Menu screens only.
// ---------------------------------------------------------------------------
export function AdBanner() {
  const colors = useColors();

  if (GMA) {
    const gma = GMA;
    return (
      <View style={bannerStyles.nativeWrap}>
        <gma.BannerAd
          unitId={UNITS.banner}
          size={gma.BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        />
      </View>
    );
  }

  return (
    <View style={[bannerStyles.banner, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Feather name="tv" size={14} color={colors.mutedForeground} />
      <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
        Banner Ad (test) — menu screens only
      </Text>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  banner: {
    height: 54,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
  },
  nativeWrap: {
    alignItems: 'center',
  },
});
