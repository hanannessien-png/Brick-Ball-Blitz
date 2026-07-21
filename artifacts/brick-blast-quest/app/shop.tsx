/**
 * Shop: ball skins, trail effects, power-ups. Coins only (no IAP in v1).
 */

import React from 'react';
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
import { POWER_UPS, SKINS, TRAILS } from '@/constants/game';

export default function ShopScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state, buySkin, buyTrail, buyPowerUp, equipSkin, equipTrail } = useGame();

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="btn-back">
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Shop</Text>
        <CoinBadge coins={state.coins} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad + 90, paddingHorizontal: 16, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        <SectionTitle label="Ball Skins" color={colors.primary} />
        <View style={styles.row}>
          {SKINS.map((s) => {
            const owned = state.ownedSkins.includes(s.id);
            const equipped = state.equippedSkin === s.id;
            return (
              <GlowCard
                key={s.id}
                style={styles.item}
                borderColor={equipped ? s.color : undefined}
              >
                <View style={[styles.skinBall, { backgroundColor: s.color, shadowColor: s.glow }]} />
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
                  {s.name}
                </Text>
                {equipped ? (
                  <Text style={{ color: colors.green, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                    Equipped
                  </Text>
                ) : owned ? (
                  <NeonButton small label="Equip" onPress={() => equipSkin(s.id)} />
                ) : (
                  <NeonButton
                    small
                    label={`${s.price}`}
                    icon="dollar-sign"
                    color={colors.gold}
                    disabled={state.coins < s.price}
                    onPress={() => buySkin(s.id, s.price)}
                  />
                )}
              </GlowCard>
            );
          })}
        </View>

        <SectionTitle label="Trail Effects" color={colors.accent} />
        <View style={styles.row}>
          {TRAILS.map((t) => {
            const owned = state.ownedTrails.includes(t.id);
            const equipped = state.equippedTrail === t.id;
            return (
              <GlowCard
                key={t.id}
                style={styles.item}
                borderColor={equipped ? (t.color ?? colors.border) : undefined}
              >
                <View style={styles.trailPreview}>
                  {t.color ? (
                    [0.25, 0.5, 1].map((o, i) => (
                      <View
                        key={i}
                        style={{
                          width: 8 + i * 3,
                          height: 8 + i * 3,
                          borderRadius: 8,
                          backgroundColor: t.color!,
                          opacity: o,
                        }}
                      />
                    ))
                  ) : (
                    <Feather name="slash" size={18} color={colors.mutedForeground} />
                  )}
                </View>
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
                  {t.name}
                </Text>
                {equipped ? (
                  <Text style={{ color: colors.green, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                    Equipped
                  </Text>
                ) : owned ? (
                  <NeonButton small label="Equip" onPress={() => equipTrail(t.id)} />
                ) : (
                  <NeonButton
                    small
                    label={`${t.price}`}
                    icon="dollar-sign"
                    color={colors.gold}
                    disabled={state.coins < t.price}
                    onPress={() => buyTrail(t.id, t.price)}
                  />
                )}
              </GlowCard>
            );
          })}
        </View>

        <SectionTitle label="Power-ups" color={colors.green} />
        {POWER_UPS.map((p) => (
          <GlowCard key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={[styles.powerIcon, { borderColor: colors.primary }]}>
              <Feather name={p.icon as keyof typeof Feather.glyphMap} size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
                {p.name}{' '}
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                  ×{state.powerUps[p.id] ?? 0}
                </Text>
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{p.description}</Text>
            </View>
            <NeonButton
              small
              label={`${p.price}`}
              icon="dollar-sign"
              color={colors.gold}
              disabled={state.coins < p.price}
              onPress={() => buyPowerUp(p.id, p.price)}
              testID={`buy-${p.id}`}
            />
          </GlowCard>
        ))}
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: bottomPad + 8 }}>
        <AdBanner />
      </View>
    </View>
  );
}

function SectionTitle({ label, color }: { label: string; color: string }) {
  return (
    <Text style={{ color, fontFamily: 'Inter_700Bold', fontSize: 14, letterSpacing: 1.5, marginTop: 10 }}>
      {label.toUpperCase()}
    </Text>
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
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  item: {
    width: '31%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  skinBall: {
    width: 26,
    height: 26,
    borderRadius: 13,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  trailPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 26,
  },
  powerIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
