/**
 * Shared neon UI primitives: NeonButton, CoinBadge, GlowCard.
 */

import React from 'react';
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export function NeonButton({
  label,
  icon,
  onPress,
  color,
  textColor = '#04121a',
  disabled,
  small,
  style,
  testID,
}: {
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  onPress: () => void;
  color?: string;
  textColor?: string;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const colors = useColors();
  const bg = color ?? colors.primary;
  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={() => {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        {
          backgroundColor: disabled ? colors.muted : bg,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
          shadowColor: bg,
        },
        !disabled && styles.glow,
        style,
      ]}
    >
      {icon ? (
        <Feather name={icon} size={small ? 15 : 18} color={disabled ? colors.mutedForeground : textColor} />
      ) : null}
      <Text
        style={[
          styles.btnText,
          small && { fontSize: 13 },
          { color: disabled ? colors.mutedForeground : textColor },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function CoinBadge({ coins, size = 'md' }: { coins: number; size?: 'md' | 'lg' }) {
  const colors = useColors();
  return (
    <View style={[styles.coin, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.coinDot, { backgroundColor: colors.gold }]}>
        <Feather name="dollar-sign" size={size === 'lg' ? 13 : 11} color="#3a2d00" />
      </View>
      <Text
        style={{
          color: colors.gold,
          fontFamily: 'Inter_700Bold',
          fontSize: size === 'lg' ? 17 : 14,
        }}
      >
        {coins.toLocaleString()}
      </Text>
    </View>
  );
}

export function GlowCard({
  children,
  style,
  borderColor,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  borderColor?: string;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: borderColor ?? colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 999,
  },
  btnSmall: { paddingHorizontal: 14, paddingVertical: 9 },
  btnText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  glow: {
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  coin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  coinDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
});
