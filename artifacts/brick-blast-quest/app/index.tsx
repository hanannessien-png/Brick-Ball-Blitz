/**
 * Home screen: play, shop, missions, spin wheel, daily reward.
 */

import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AdBanner } from '@/context/AdContext';
import { useGame } from '@/context/GameContext';
import { NeonButton, CoinBadge, GlowCard } from '@/components/ui';
import { DAILY_REWARDS, MISSIONS, PowerUpId } from '@/constants/game';

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state, canClaimDaily, claimDailyReward } = useGame();
  const [dailyResult, setDailyResult] = useState<{ coins: number; powerUp?: PowerUpId } | null>(
    null,
  );

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const claimableMissions = MISSIONS.filter(
    (m) => (state.missionProgress[m.id] ?? 0) >= m.target && !state.missionClaimed[m.id],
  ).length;

  const nextReward = DAILY_REWARDS[state.dailyStreak % DAILY_REWARDS.length];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: bottomPad + 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.kicker, { color: colors.primary }]}>NEON ARCADE</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>
              BRICK <Text style={{ color: colors.accent }}>BLAST</Text>
            </Text>
            <Text style={[styles.titleSub, { color: colors.gold }]}>QUEST</Text>
          </View>
          <CoinBadge coins={state.coins} size="lg" />
        </View>

        {/* Level card */}
        <GlowCard style={styles.levelCard} borderColor={colors.primary + '55'}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
                CURRENT LEVEL
              </Text>
              <Text style={{ color: colors.foreground, fontSize: 40, fontFamily: 'Inter_700Bold' }}>
                {state.level}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', justifyContent: 'flex-end' }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                Best: Level {state.highScore || '—'}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                Bricks smashed: {state.totalBricks.toLocaleString()}
              </Text>
            </View>
          </View>
          <NeonButton
            label="PLAY"
            icon="play"
            onPress={() => router.push('/game')}
            testID="btn-play"
            style={{ marginTop: 14 }}
          />
        </GlowCard>

        {/* Menu grid */}
        <View style={styles.grid}>
          <MenuTile
            icon="shopping-bag"
            label="Shop"
            color={colors.primary}
            onPress={() => router.push('/shop')}
            testID="tile-shop"
          />
          <MenuTile
            icon="target"
            label="Missions"
            color={colors.green}
            badge={claimableMissions > 0 ? claimableMissions : undefined}
            onPress={() => router.push('/missions')}
            testID="tile-missions"
          />
          <MenuTile
            icon="disc"
            label="Spin"
            color={colors.accent}
            onPress={() => router.push('/spin')}
            testID="tile-spin"
          />
          <MenuTile
            icon="gift"
            label="Daily"
            color={colors.gold}
            badge={canClaimDaily ? 1 : undefined}
            onPress={() => {
              if (canClaimDaily) {
                const r = claimDailyReward();
                if (r) setDailyResult(r);
              } else {
                setDailyResult({ coins: 0 });
              }
            }}
            testID="tile-daily"
          />
        </View>

        {/* Daily teaser */}
        <GlowCard style={{ marginHorizontal: 16, marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Feather name="calendar" size={20} color={colors.gold} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
                Day {(state.dailyStreak % DAILY_REWARDS.length) + 1} reward
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                {canClaimDaily
                  ? `Claim ${nextReward.coins} coins${nextReward.powerUp ? ' + power-up' : ''} now!`
                  : 'Come back tomorrow for your next reward'}
              </Text>
            </View>
            {canClaimDaily ? (
              <View style={[styles.dot, { backgroundColor: colors.accent }]} />
            ) : (
              <Feather name="check" size={18} color={colors.green} />
            )}
          </View>
        </GlowCard>
      </ScrollView>

      {/* Banner ad — menu only */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: bottomPad + 8 }}>
        <AdBanner />
      </View>

      {/* Daily reward modal */}
      <Modal visible={dailyResult !== null} transparent animationType="fade">
        <View style={styles.modalWrap}>
          <View style={[styles.modal, { backgroundColor: colors.card, borderColor: colors.gold }]}>
            {dailyResult && dailyResult.coins > 0 ? (
              <>
                <Feather name="gift" size={44} color={colors.gold} />
                <Text style={{ color: colors.foreground, fontSize: 20, fontFamily: 'Inter_700Bold' }}>
                  Daily Reward!
                </Text>
                <Text style={{ color: colors.gold, fontSize: 26, fontFamily: 'Inter_700Bold' }}>
                  +{dailyResult.coins} coins
                </Text>
                {dailyResult.powerUp ? (
                  <Text style={{ color: colors.green, fontFamily: 'Inter_600SemiBold' }}>
                    + 1 power-up!
                  </Text>
                ) : null}
              </>
            ) : (
              <>
                <Feather name="clock" size={44} color={colors.mutedForeground} />
                <Text style={{ color: colors.foreground, fontSize: 18, fontFamily: 'Inter_700Bold' }}>
                  Already claimed
                </Text>
                <Text style={{ color: colors.mutedForeground, textAlign: 'center' }}>
                  Come back tomorrow to keep your streak going!
                </Text>
              </>
            )}
            <NeonButton label="OK" onPress={() => setDailyResult(null)} style={{ alignSelf: 'stretch' }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MenuTile({
  icon,
  label,
  color,
  onPress,
  badge,
  testID,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
  badge?: number;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: colors.card,
          borderColor: color + '66',
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
      ]}
    >
      <Feather name={icon} size={26} color={color} />
      <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
        {label}
      </Text>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.accent }]}>
          <Text style={{ color: '#fff', fontSize: 10, fontFamily: 'Inter_700Bold' }}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  kicker: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 3 },
  title: { fontSize: 34, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  titleSub: { fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: 6, marginTop: -4 },
  levelCard: { marginHorizontal: 16 },
  grid: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  tile: {
    flex: 1,
    aspectRatio: 0.95,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(3,5,15,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
});
