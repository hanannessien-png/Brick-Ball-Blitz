/**
 * Missions: daily / weekly / monthly tabs with progress bars and claim buttons.
 */

import React, { useState } from 'react';
import {
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
import { CoinBadge, GlowCard, NeonButton } from '@/components/ui';
import { MISSIONS, MissionPeriod } from '@/constants/game';

const PERIODS: { id: MissionPeriod; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

export default function MissionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state, claimMission } = useGame();
  const [tab, setTab] = useState<MissionPeriod>('daily');

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const missions = MISSIONS.filter((m) => m.period === tab);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Missions</Text>
        <CoinBadge coins={state.coins} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {PERIODS.map((p) => {
          const active = tab === p.id;
          const claimable = MISSIONS.filter(
            (m) =>
              m.period === p.id &&
              (state.missionProgress[m.id] ?? 0) >= m.target &&
              !state.missionClaimed[m.id],
          ).length;
          return (
            <Pressable
              key={p.id}
              onPress={() => setTab(p.id)}
              style={[
                styles.tab,
                {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
              testID={`tab-${p.id}`}
            >
              <Text
                style={{
                  color: active ? colors.primaryForeground : colors.mutedForeground,
                  fontFamily: 'Inter_600SemiBold',
                  fontSize: 13,
                }}
              >
                {p.label}
              </Text>
              {claimable > 0 ? (
                <View style={[styles.tabBadge, { backgroundColor: colors.accent }]}>
                  <Text style={{ color: '#fff', fontSize: 10, fontFamily: 'Inter_700Bold' }}>
                    {claimable}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: bottomPad + 90 }}
        showsVerticalScrollIndicator={false}
      >
        {missions.map((m) => {
          const progress = Math.min(m.target, state.missionProgress[m.id] ?? 0);
          const done = progress >= m.target;
          const claimed = !!state.missionClaimed[m.id];
          const pct = progress / m.target;
          return (
            <GlowCard
              key={m.id}
              style={{ gap: 8 }}
              borderColor={done && !claimed ? colors.gold : undefined}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
                    {m.title}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                    {progress.toLocaleString()} / {m.target.toLocaleString()}
                  </Text>
                </View>
                {claimed ? (
                  <Feather name="check-circle" size={20} color={colors.green} />
                ) : done ? (
                  <NeonButton
                    small
                    label={`+${m.reward}`}
                    icon="dollar-sign"
                    color={colors.gold}
                    onPress={() => claimMission(m.id)}
                    testID={`claim-${m.id}`}
                  />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Feather name="dollar-sign" size={13} color={colors.gold} />
                    <Text style={{ color: colors.gold, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
                      {m.reward}
                    </Text>
                  </View>
                )}
              </View>
              <View style={[styles.barBg, { backgroundColor: colors.muted }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      backgroundColor: claimed ? colors.green : done ? colors.gold : colors.primary,
                      width: `${Math.round(pct * 100)}%`,
                    },
                  ]}
                />
              </View>
            </GlowCard>
          );
        })}
      </ScrollView>

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
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 9,
  },
  tabBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  barBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
});
