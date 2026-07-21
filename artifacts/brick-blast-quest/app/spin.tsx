/**
 * Spin Wheel: every spin requires watching a rewarded ad.
 */

import React, { useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { AdBanner, useAds } from '@/context/AdContext';
import { useGame } from '@/context/GameContext';
import { CoinBadge, NeonButton } from '@/components/ui';
import { SPIN_PRIZES, SpinPrize } from '@/constants/game';

const WHEEL_SIZE = 280;
const SEG = 360 / SPIN_PRIZES.length;

export default function SpinScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state, addCoins, grantPowerUp, recordEvent } = useGame();
  const { showRewardedAd } = useAds();

  const rotation = useRef(new Animated.Value(0)).current;
  const totalDeg = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinPrize | null>(null);

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const onSpin = async () => {
    if (spinning) return;
    setResult(null);
    const earned = await showRewardedAd();
    if (!earned) return;
    recordEvent('adsWatched', 1);
    recordEvent('spinsUsed', 1);
    setSpinning(true);

    const idx = Math.floor(Math.random() * SPIN_PRIZES.length);
    const prize = SPIN_PRIZES[idx];
    // land pointer (top) on segment center
    const target = 360 * 5 + (360 - (idx * SEG + SEG / 2));
    totalDeg.current += target - (totalDeg.current % 360);
    Animated.timing(rotation, {
      toValue: totalDeg.current,
      duration: 3200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setSpinning(false);
      setResult(prize);
      if (prize.coins) addCoins(prize.coins);
      if (prize.powerUp) grantPowerUp(prize.powerUp, 1);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    });
  };

  const spin = rotation.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Lucky Spin</Text>
        <CoinBadge coins={state.coins} />
      </View>

      <View style={styles.center}>
        {/* pointer */}
        <View style={[styles.pointer, { borderTopColor: colors.accent }]} />
        <Animated.View
          style={[
            styles.wheel,
            {
              borderColor: colors.border,
              backgroundColor: colors.card,
              transform: [{ rotate: spin }],
            },
          ]}
        >
          {SPIN_PRIZES.map((p, i) => {
            const angle = i * SEG + SEG / 2;
            return (
              <View
                key={p.id}
                style={[
                  styles.segment,
                  { transform: [{ rotate: `${angle}deg` }] },
                ]}
              >
                <View style={[styles.segDot, { backgroundColor: p.color, shadowColor: p.color }]} />
                <Text style={[styles.segLabel, { color: p.color }]}>{p.label}</Text>
              </View>
            );
          })}
          <View style={[styles.hub, { backgroundColor: colors.background, borderColor: colors.primary }]}>
            <Feather name="disc" size={22} color={colors.primary} />
          </View>
        </Animated.View>

        <Text style={{ color: colors.mutedForeground, marginTop: 26, textAlign: 'center', fontSize: 13 }}>
          Coins, power-ups & jackpots.{'\n'}Every spin is free — just watch an ad.
        </Text>

        {result ? (
          <View style={[styles.result, { backgroundColor: colors.card, borderColor: result.color }]}>
            <Feather name="award" size={18} color={result.color} />
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold' }}>
              {result.coins ? `+${result.coins} coins!` : `+1 ${result.label} power-up!`}
            </Text>
          </View>
        ) : null}

        <NeonButton
          label={spinning ? 'Spinning…' : 'Watch Ad & Spin'}
          icon="video"
          color={colors.accent}
          textColor="#fff"
          disabled={spinning}
          onPress={onSpin}
          testID="btn-spin"
          style={{ marginTop: 18, minWidth: 220 }}
        />
      </View>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: bottomPad + 8 }}>
        <AdBanner />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  pointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 20,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    zIndex: 2,
    marginBottom: -6,
  },
  wheel: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: WHEEL_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segment: {
    position: 'absolute',
    top: 0,
    left: WHEEL_SIZE / 2 - 30,
    width: 60,
    height: WHEEL_SIZE / 2,
    alignItems: 'center',
    paddingTop: 14,
  },
  segDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 4,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  segLabel: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  hub: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 16,
  },
});
