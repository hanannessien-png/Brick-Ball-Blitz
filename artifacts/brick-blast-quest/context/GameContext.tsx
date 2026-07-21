/**
 * Global player state: coins, progression, shop, power-ups, missions,
 * daily rewards. Persisted to AsyncStorage.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DAILY_REWARDS,
  MISSIONS,
  MissionMetric,
  MissionPeriod,
  PowerUpId,
  START_COINS,
  periodKey,
} from '@/constants/game';

export interface PlayerState {
  coins: number;
  level: number; // next level to play
  highScore: number; // best level beaten
  totalBricks: number;
  ownedSkins: string[];
  equippedSkin: string;
  ownedTrails: string[];
  equippedTrail: string;
  powerUps: Record<PowerUpId, number>;
  // Daily rewards
  lastDailyClaim: string | null; // daily period key
  dailyStreak: number; // 0..6 index into DAILY_REWARDS for next claim
  // Missions
  missionProgress: Record<string, number>;
  missionClaimed: Record<string, boolean>;
  missionPeriods: Record<MissionPeriod, string>;
}

const now = () => new Date(Date.now());

function defaultState(): PlayerState {
  const d = now();
  return {
    coins: START_COINS,
    level: 1,
    highScore: 0,
    totalBricks: 0,
    ownedSkins: ['classic'],
    equippedSkin: 'classic',
    ownedTrails: ['none'],
    equippedTrail: 'none',
    powerUps: { rowBlast: 1, laser: 1, slow: 0 },
    lastDailyClaim: null,
    dailyStreak: 0,
    missionProgress: {},
    missionClaimed: {},
    missionPeriods: {
      daily: periodKey('daily', d),
      weekly: periodKey('weekly', d),
      monthly: periodKey('monthly', d),
    },
  };
}

interface GameContextValue {
  state: PlayerState;
  loaded: boolean;
  addCoins: (n: number) => void;
  spendCoins: (n: number) => boolean;
  recordEvent: (metric: MissionMetric, amount: number) => void;
  levelBeaten: (level: number) => void;
  buySkin: (id: string, price: number) => boolean;
  buyTrail: (id: string, price: number) => boolean;
  buyPowerUp: (id: PowerUpId, price: number) => boolean;
  equipSkin: (id: string) => void;
  equipTrail: (id: string) => void;
  consumePowerUp: (id: PowerUpId) => boolean;
  grantPowerUp: (id: PowerUpId, n: number) => void;
  claimMission: (id: string) => void;
  canClaimDaily: boolean;
  claimDailyReward: () => { coins: number; powerUp?: PowerUpId } | null;
}

const GameContext = createContext<GameContextValue | null>(null);

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}

const STORAGE_KEY = 'bbq:player:v1';

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PlayerState>(defaultState);
  const [loaded, setLoaded] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Load
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as PlayerState;
          setState({ ...defaultState(), ...parsed });
        }
      } catch {
        // corrupted storage — start fresh
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Persist (debounced-ish: every state change)
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, loaded]);

  // Reset mission progress when periods roll over
  useEffect(() => {
    if (!loaded) return;
    const d = now();
    const fresh: Record<MissionPeriod, string> = {
      daily: periodKey('daily', d),
      weekly: periodKey('weekly', d),
      monthly: periodKey('monthly', d),
    };
    const stale = (Object.keys(fresh) as MissionPeriod[]).filter(
      (p) => state.missionPeriods[p] !== fresh[p],
    );
    if (stale.length === 0) return;
    setState((s) => {
      const progress = { ...s.missionProgress };
      const claimed = { ...s.missionClaimed };
      for (const m of MISSIONS) {
        if (stale.includes(m.period)) {
          delete progress[m.id];
          delete claimed[m.id];
        }
      }
      return { ...s, missionProgress: progress, missionClaimed: claimed, missionPeriods: fresh };
    });
  }, [loaded, state.missionPeriods]);

  const addCoins = useCallback((n: number) => {
    setState((s) => ({ ...s, coins: s.coins + n }));
    if (n > 0) recordEventInternal('coinsEarned', n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spendCoins = useCallback((n: number): boolean => {
    if (stateRef.current.coins < n) return false;
    setState((s) => ({ ...s, coins: s.coins - n }));
    return true;
  }, []);

  const recordEventInternal = (metric: MissionMetric, amount: number) => {
    setState((s) => {
      const progress = { ...s.missionProgress };
      for (const m of MISSIONS) {
        if (m.metric !== metric) continue;
        const cur = progress[m.id] ?? 0;
        progress[m.id] =
          metric === 'levelReached' ? Math.max(cur, amount) : Math.min(m.target, cur + amount);
      }
      const totalBricks = metric === 'bricksBroken' ? s.totalBricks + amount : s.totalBricks;
      return { ...s, missionProgress: progress, totalBricks };
    });
  };

  const recordEvent = useCallback((metric: MissionMetric, amount: number) => {
    recordEventInternal(metric, amount);
  }, []);

  const levelBeaten = useCallback((level: number) => {
    setState((s) => ({
      ...s,
      level: Math.max(s.level, level + 1),
      highScore: Math.max(s.highScore, level),
    }));
    recordEventInternal('levelReached', level);
  }, []);

  const buy = (price: number): boolean => {
    if (stateRef.current.coins < price) return false;
    return true;
  };

  const buySkin = useCallback((id: string, price: number): boolean => {
    if (!buy(price)) return false;
    setState((s) => ({
      ...s,
      coins: s.coins - price,
      ownedSkins: [...s.ownedSkins, id],
      equippedSkin: id,
    }));
    return true;
  }, []);

  const buyTrail = useCallback((id: string, price: number): boolean => {
    if (!buy(price)) return false;
    setState((s) => ({
      ...s,
      coins: s.coins - price,
      ownedTrails: [...s.ownedTrails, id],
      equippedTrail: id,
    }));
    return true;
  }, []);

  const buyPowerUp = useCallback((id: PowerUpId, price: number): boolean => {
    if (!buy(price)) return false;
    setState((s) => ({
      ...s,
      coins: s.coins - price,
      powerUps: { ...s.powerUps, [id]: (s.powerUps[id] ?? 0) + 1 },
    }));
    return true;
  }, []);

  const equipSkin = useCallback((id: string) => {
    setState((s) => (s.ownedSkins.includes(id) ? { ...s, equippedSkin: id } : s));
  }, []);

  const equipTrail = useCallback((id: string) => {
    setState((s) => (s.ownedTrails.includes(id) ? { ...s, equippedTrail: id } : s));
  }, []);

  const consumePowerUp = useCallback((id: PowerUpId): boolean => {
    if ((stateRef.current.powerUps[id] ?? 0) <= 0) return false;
    setState((s) => ({ ...s, powerUps: { ...s.powerUps, [id]: s.powerUps[id] - 1 } }));
    recordEventInternal('powerUpsUsed', 1);
    return true;
  }, []);

  const grantPowerUp = useCallback((id: PowerUpId, n: number) => {
    setState((s) => ({ ...s, powerUps: { ...s.powerUps, [id]: (s.powerUps[id] ?? 0) + n } }));
  }, []);

  const claimMission = useCallback((id: string) => {
    const def = MISSIONS.find((m) => m.id === id);
    if (!def) return;
    const s = stateRef.current;
    if (s.missionClaimed[id]) return;
    if ((s.missionProgress[id] ?? 0) < def.target) return;
    setState((prev) => ({
      ...prev,
      coins: prev.coins + def.reward,
      missionClaimed: { ...prev.missionClaimed, [id]: true },
    }));
    recordEventInternal('coinsEarned', def.reward);
  }, []);

  const todayKey = periodKey('daily', now());
  const canClaimDaily = loaded && state.lastDailyClaim !== todayKey;

  const claimDailyReward = useCallback((): { coins: number; powerUp?: PowerUpId } | null => {
    const s = stateRef.current;
    const key = periodKey('daily', now());
    if (s.lastDailyClaim === key) return null;
    const reward = DAILY_REWARDS[s.dailyStreak % DAILY_REWARDS.length];
    setState((prev) => ({
      ...prev,
      coins: prev.coins + reward.coins,
      powerUps: reward.powerUp
        ? { ...prev.powerUps, [reward.powerUp]: (prev.powerUps[reward.powerUp] ?? 0) + 1 }
        : prev.powerUps,
      lastDailyClaim: key,
      dailyStreak: (prev.dailyStreak + 1) % DAILY_REWARDS.length,
    }));
    recordEventInternal('coinsEarned', reward.coins);
    return reward;
  }, []);

  const value = useMemo<GameContextValue>(
    () => ({
      state,
      loaded,
      addCoins,
      spendCoins,
      recordEvent,
      levelBeaten,
      buySkin,
      buyTrail,
      buyPowerUp,
      equipSkin,
      equipTrail,
      consumePowerUp,
      grantPowerUp,
      claimMission,
      canClaimDaily,
      claimDailyReward,
    }),
    [
      state,
      loaded,
      addCoins,
      spendCoins,
      recordEvent,
      levelBeaten,
      buySkin,
      buyTrail,
      buyPowerUp,
      equipSkin,
      equipTrail,
      consumePowerUp,
      grantPowerUp,
      claimMission,
      canClaimDaily,
      claimDailyReward,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
