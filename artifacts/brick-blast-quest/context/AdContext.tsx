/**
 * Ads layer for Brick Blast Quest.
 *
 * IMPORTANT — HOW THIS WORKS:
 * This app runs in Expo Go, which cannot load the native Google Mobile Ads SDK.
 * So this file implements a *simulated* ad layer with the exact same API shape
 * you will use in production. Every placement (App Open, Rewarded, Interstitial,
 * Banner) is wired through here, so switching to real AdMob is a single-file change.
 *
 * ===== GOING TO PRODUCTION WITH REAL ADMOB =====
 * 1. `npx expo install react-native-google-mobile-ads`
 * 2. Add to app.json plugins:
 *      ["react-native-google-mobile-ads", {
 *        "androidAppId": "ca-app-pub-XXXXXXXX~YYYYYYYY",
 *        "iosAppId": "ca-app-pub-XXXXXXXX~ZZZZZZZZ" }]
 * 3. Build a dev client / production build (AdMob does NOT work in Expo Go).
 * 4. Replace the bodies of showRewardedAd / showInterstitialAd / showAppOpenAd
 *    below with the SDK calls (RewardedAd.createForAdRequest, etc.) and swap
 *    <FakeBanner /> for <BannerAd unitId={...} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />.
 * 5. Use Google's TEST unit IDs until the app is approved:
 *      Banner       ca-app-pub-3940256099942544/6300978111
 *      Interstitial ca-app-pub-3940256099942544/1033173712
 *      Rewarded     ca-app-pub-3940256099942544/5224354917
 *      App Open     ca-app-pub-3940256099942544/9257395921
 *    Then replace them with your real unit IDs from the AdMob console.
 *
 * Policy notes baked into this design:
 * - Interstitials only between games (never during gameplay), every 2 games.
 * - Rewarded ads are always optional and user-initiated.
 * - Banner only on menu screens, never on the gameplay screen.
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

type AdKind = 'rewarded' | 'interstitial' | 'appopen';

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

const AD_DURATION: Record<AdKind, number> = {
  rewarded: 5,
  interstitial: 3,
  appopen: 2,
};

export function AdProvider({ children }: { children: React.ReactNode }) {
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

  const close = useCallback(
    (earned: boolean) => {
      setVisible(false);
      resolver.current?.(earned);
      resolver.current = null;
    },
    [],
  );

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
      <AdOverlay
        visible={visible}
        kind={kind}
        remaining={remaining}
        onClose={close}
      />
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
          {'\n'}Replace with AdMob in production (see AdContext.tsx)
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

/**
 * Banner placeholder — menu screens only.
 * In production replace with:
 *   <BannerAd unitId={bannerUnitId} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
 */
export function AdBanner() {
  const colors = useColors();
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
});
