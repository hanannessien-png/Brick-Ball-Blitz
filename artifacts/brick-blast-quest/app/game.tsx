/**
 * Gameplay screen: aim by dragging, release to fire, balls bounce, bricks
 * descend each turn. Frame loop runs on requestAnimationFrame with state
 * held in refs; React state only mirrors what needs rendering.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  PanResponder,
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
import { NeonButton, CoinBadge } from '@/components/ui';
import { useAds } from '@/context/AdContext';
import { useGame } from '@/context/GameContext';
import {
  CONTINUE_COSTS,
  CONTINUE_MIN_PROGRESS,
  POWER_UPS,
  REWARDED_EXTRA_BALLS,
  SKINS,
  TRAILS,
  winCoins,
} from '@/constants/game';
import {
  BALL_RADIUS,
  BALL_SPEED,
  Brick,
  LevelState,
  Layout,
  MAX_ROWS,
  advanceTurn,
  bonusCenter,
  brickColor,
  brickRect,
  collideBrick,
  computeAimPath,
  generateLevel,
  makeLayout,
  newId,
  startingBalls,
} from '@/game/engine';

interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
  lastBrick: number; // brick id hit most recently (avoid double-hit jitter)
  lastHitAt: number;
}

type Phase = 'aiming' | 'firing' | 'gameover' | 'won';

const haptic = (style: Haptics.ImpactFeedbackStyle) => {
  if (Platform.OS !== 'web') Haptics.impactAsync(style).catch(() => {});
};

export default function GameScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state, addCoins, spendCoins, recordEvent, levelBeaten, consumePowerUp, grantPowerUp } =
    useGame();
  const { showRewardedAd, maybeShowInterstitial } = useAds();

  const level = state.level;
  const skin = SKINS.find((s) => s.id === state.equippedSkin) ?? SKINS[0];
  const trail = TRAILS.find((t) => t.id === state.equippedTrail) ?? TRAILS[0];

  // ------- board layout -------
  const [board, setBoard] = useState<{ w: number; h: number } | null>(null);
  const layout: Layout | null = useMemo(
    () => (board ? makeLayout(board.w, board.h) : null),
    [board],
  );

  // ------- refs for the loop -------
  const levelRef = useRef<LevelState>(generateLevel(level));
  const ballsRef = useRef<Ball[]>([]);
  const launchX = useRef(0);
  const nextLaunchX = useRef<number | null>(null);
  const ballCountRef = useRef(1);
  const firedRef = useRef(0);
  const fireTimer = useRef(0);
  const aimRef = useRef<{ dx: number; dy: number } | null>(null);
  const phaseRef = useRef<Phase>('aiming');
  const frozenNextTurn = useRef(false);
  const laserTurns = useRef(0);
  const continueCount = useRef(0);
  const initialHp = useRef(1);
  const destroyedHp = useRef(0);
  const bricksThisGame = useRef(0);
  const endedReported = useRef(false);

  // ------- render state (mirrors refs ~30fps) -------
  const [, setTick] = useState(0);
  const [phase, setPhase] = useState<Phase>('aiming');
  const [ballCount, setBallCount] = useState(1);
  const [aim, setAim] = useState<{ dx: number; dy: number } | null>(null);
  const [ballPulse, setBallPulse] = useState(0); // increments on ball pickup for the "+1" pop
  const [winInfo, setWinInfo] = useState<{ coins: number; doubled: boolean } | null>(null);
  const [showContinue, setShowContinue] = useState(false);

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  // Initialize level once per mount
  useEffect(() => {
    const st = generateLevel(level);
    levelRef.current = st;
    initialHp.current = Math.max(1, st.totalHp);
    destroyedHp.current = 0;
    const start = startingBalls(level);
    ballCountRef.current = start;
    setBallCount(start);
    recordEvent('gamesPlayed', 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const layoutRef = useRef<Layout | null>(null);
  useEffect(() => {
    layoutRef.current = layout;
    if (layout && launchX.current === 0) {
      launchX.current = layout.boardW / 2;
    }
  }, [layout]);

  // ------- game end handlers -------
  const handleWin = useCallback(() => {
    if (endedReported.current) return;
    endedReported.current = true;
    const coins = winCoins(level);
    addCoins(coins);
    recordEvent('gamesWon', 1);
    levelBeaten(level);
    setWinInfo({ coins, doubled: false });
    setPhaseBoth('won');
    haptic(Haptics.ImpactFeedbackStyle.Heavy);
  }, [level, addCoins, recordEvent, levelBeaten]);

  const handleLoss = useCallback(() => {
    const progress = destroyedHp.current / initialHp.current;
    // Profit design: offer Continue only when the player is close to winning
    if (progress >= CONTINUE_MIN_PROGRESS && continueCount.current < CONTINUE_COSTS.length) {
      setShowContinue(true);
    } else {
      setShowContinue(false);
    }
    setPhaseBoth('gameover');
    haptic(Haptics.ImpactFeedbackStyle.Heavy);
  }, []);

  // ------- frame loop -------
  useEffect(() => {
    let raf = 0;
    let last = 0;
    let frame = 0;

    const step = (t: number) => {
      raf = requestAnimationFrame(step);
      if (!layout) return;
      if (!last) last = t;
      let dt = Math.min(0.032, (t - last) / 1000);
      last = t;
      if (phaseRef.current !== 'firing') return;

      // stagger-launch remaining balls
      fireTimer.current -= dt;
      if (firedRef.current < ballCountRef.current && fireTimer.current <= 0 && aimRef.current) {
        const a = aimRef.current;
        ballsRef.current.push({
          id: newId(),
          x: launchX.current,
          y: layout.boardH - BALL_RADIUS - 2,
          vx: a.dx * BALL_SPEED,
          vy: a.dy * BALL_SPEED,
          active: true,
          lastBrick: -1,
          lastHitAt: 0,
        });
        firedRef.current += 1;
        fireTimer.current = 0.09;
      }

      const st = levelRef.current;
      // 6 substeps → ≤ ~4.4px travel per check, keeping penetration depth well
      // inside the triangle's diagonal-reflection threshold (r * 1.2).
      const subSteps = 6;
      const sdt = dt / subSteps;

      for (let s = 0; s < subSteps; s++) {
        for (const ball of ballsRef.current) {
          if (!ball.active) continue;
          ball.x += ball.vx * sdt;
          ball.y += ball.vy * sdt;

          // walls
          if (ball.x < BALL_RADIUS) {
            ball.x = BALL_RADIUS;
            ball.vx = Math.abs(ball.vx);
          } else if (ball.x > layout.boardW - BALL_RADIUS) {
            ball.x = layout.boardW - BALL_RADIUS;
            ball.vx = -Math.abs(ball.vx);
          }
          if (ball.y < BALL_RADIUS) {
            ball.y = BALL_RADIUS;
            ball.vy = Math.abs(ball.vy);
          }
          // floor: ball returns
          if (ball.y > layout.boardH + BALL_RADIUS) {
            ball.active = false;
            if (nextLaunchX.current === null) {
              nextLaunchX.current = Math.max(
                BALL_RADIUS,
                Math.min(layout.boardW - BALL_RADIUS, ball.x),
              );
            }
            continue;
          }

          // bricks
          const nowMs = t;
          for (const brick of st.bricks) {
            if (brick.hp <= 0) continue;
            if (brick.id === ball.lastBrick && nowMs - ball.lastHitAt < 50) continue;
            const refl = collideBrick(layout, brick, ball.x, ball.y, BALL_RADIUS, ball.vx, ball.vy);
            if (!refl) continue;
            if (refl.kind === 'x') ball.vx = -ball.vx;
            else if (refl.kind === 'y') ball.vy = -ball.vy;
            else {
              // diagonal bounce off a triangle's sloped edge: v' = v - 2(v·n)n
              const dot = ball.vx * refl.nx! + ball.vy * refl.ny!;
              ball.vx -= 2 * dot * refl.nx!;
              ball.vy -= 2 * dot * refl.ny!;
            }
            ball.lastBrick = brick.id;
            ball.lastHitAt = nowMs;
            damageBrick(st, brick, 1);
            haptic(Haptics.ImpactFeedbackStyle.Light);
            break;
          }

          // bonus balls
          for (const bonus of st.bonuses) {
            const c = bonusCenter(layout, bonus.row, bonus.col);
            const dx = ball.x - c.x;
            const dy = ball.y - c.y;
            if (dx * dx + dy * dy < (BALL_RADIUS + 13) * (BALL_RADIUS + 13)) {
              st.bonuses = st.bonuses.filter((b) => b.id !== bonus.id);
              ballCountRef.current += 1;
              setBallCount(ballCountRef.current);
              setBallPulse((p) => p + 1);
              recordEvent('ballsCollected', 1);
              haptic(Haptics.ImpactFeedbackStyle.Medium);
              break;
            }
          }
        }
      }

      // clean dead bricks
      if (st.bricks.some((b) => b.hp <= 0)) {
        st.bricks = st.bricks.filter((b) => b.hp > 0);
      }

      // turn over?
      const allDone =
        firedRef.current >= ballCountRef.current && ballsRef.current.every((b) => !b.active);
      if (allDone) {
        ballsRef.current = [];
        firedRef.current = 0;
        if (nextLaunchX.current !== null) {
          launchX.current = nextLaunchX.current;
          nextLaunchX.current = null;
        }
        if (laserTurns.current > 0) laserTurns.current -= 1;

        if (st.bricks.length === 0 && st.queue.length === 0) {
          handleWin();
          return;
        }
        const dead = advanceTurn(st, frozenNextTurn.current);
        frozenNextTurn.current = false;
        if (dead) {
          handleLoss();
          return;
        }
        setPhaseBoth('aiming');
      }

      frame++;
      if (frame % 2 === 0) setTick((x) => x + 1); // ~30fps React re-render
    };

    const damageBrick = (st: LevelState, brick: Brick, dmg: number) => {
      brick.hp -= dmg;
      destroyedHp.current += dmg;
      if (brick.hp <= 0) {
        bricksThisGame.current += 1;
        recordEvent('bricksBroken', 1);
        if (brick.type === 'coin') addCoins(5);
        if (brick.type === 'explosive') {
          // damage all neighbors
          for (const other of st.bricks) {
            if (other.id === brick.id || other.hp <= 0) continue;
            if (Math.abs(other.row - brick.row) <= 1 && Math.abs(other.col - brick.col) <= 1) {
              const d = Math.min(other.hp, 6);
              other.hp -= d;
              destroyedHp.current += d;
              if (other.hp <= 0) {
                bricksThisGame.current += 1;
                recordEvent('bricksBroken', 1);
                if (other.type === 'coin') addCoins(5);
              }
            }
          }
          haptic(Haptics.ImpactFeedbackStyle.Heavy);
        }
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [layout, addCoins, recordEvent, handleWin, handleLoss]);

  // ------- aiming (point-at-target, like the original game) -------
  // The dotted laser goes from the ball TOWARD the finger. Dragging the finger
  // below the ball cancels the shot. The guide shows the wall ricochet and
  // stops at bricks the current ball count can't break through.
  const boardOffset = useRef({ x: 0, y: 0 });
  const boardRef = useRef<View>(null);

  const measureBoard = () => {
    boardRef.current?.measureInWindow((x, y) => {
      boardOffset.current = { x, y };
    });
  };

  const updateAim = useCallback((pageX: number, pageY: number) => {
    const l = layoutRef.current;
    if (!l || phaseRef.current !== 'aiming') return;
    const fx = pageX - boardOffset.current.x;
    const fy = pageY - boardOffset.current.y;
    const lx = launchX.current;
    const ly = l.boardH - BALL_RADIUS - 2;
    // finger at/below the ball → cancel zone (release won't fire)
    if (fy >= ly - 14) {
      aimRef.current = null;
      setAim(null);
      return;
    }
    let ax = fx - lx;
    let ay = fy - ly;
    const len = Math.sqrt(ax * ax + ay * ay);
    if (len < 8) {
      aimRef.current = null;
      setAim(null);
      return;
    }
    ax /= len;
    ay /= len;
    // never near-horizontal
    if (ay > -0.12) {
      const sign = ax >= 0 ? 1 : -1;
      ay = -0.12;
      ax = sign * Math.sqrt(1 - ay * ay);
    }
    const v = { dx: ax, dy: ay };
    aimRef.current = v;
    setAim(v);
  }, []);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => phaseRef.current === 'aiming',
        onMoveShouldSetPanResponder: () => phaseRef.current === 'aiming',
        onPanResponderGrant: (e) => {
          // measureInWindow is async — sample the aim inside its callback so the
          // first touch never uses a stale board offset.
          const { pageX, pageY } = e.nativeEvent;
          const node = boardRef.current;
          if (node) {
            node.measureInWindow((x, y) => {
              boardOffset.current = { x, y };
              updateAim(pageX, pageY);
            });
          } else {
            updateAim(pageX, pageY);
          }
        },
        onPanResponderMove: (e) => {
          updateAim(e.nativeEvent.pageX, e.nativeEvent.pageY);
        },
        onPanResponderRelease: () => {
          if (phaseRef.current !== 'aiming' || !aimRef.current) {
            setAim(null);
            return; // cancelled — no shot
          }
          firedRef.current = 0;
          fireTimer.current = 0;
          setPhaseBoth('firing');
          setAim(null);
          haptic(Haptics.ImpactFeedbackStyle.Medium);
        },
        onPanResponderTerminate: () => {
          aimRef.current = null;
          setAim(null);
        },
      }),
    [updateAim],
  );

  // ------- actions -------
  const onExtraBalls = async () => {
    const earned = await showRewardedAd();
    if (earned) {
      ballCountRef.current += REWARDED_EXTRA_BALLS;
      setBallCount(ballCountRef.current);
      setBallPulse((p) => p + 1);
      recordEvent('adsWatched', 1);
      haptic(Haptics.ImpactFeedbackStyle.Heavy);
    }
  };

  const doContinue = () => {
    const st = levelRef.current;
    // push all bricks up 3 rows and clear anything at the bottom
    for (const b of st.bricks) b.row = Math.max(0, b.row - 3);
    st.bricks = st.bricks.filter((b) => b.row < MAX_ROWS - 1);
    continueCount.current += 1;
    endedReported.current = false;
    setShowContinue(false);
    setPhaseBoth('aiming');
  };

  const onContinueAd = async () => {
    const earned = await showRewardedAd();
    if (earned) {
      recordEvent('adsWatched', 1);
      doContinue();
    }
  };

  const onContinueCoins = () => {
    const cost = CONTINUE_COSTS[Math.min(continueCount.current, CONTINUE_COSTS.length - 1)];
    if (spendCoins(cost)) doContinue();
  };

  const onDoubleCoins = async () => {
    if (!winInfo || winInfo.doubled) return;
    const earned = await showRewardedAd();
    if (earned) {
      addCoins(winInfo.coins);
      recordEvent('adsWatched', 1);
      setWinInfo({ coins: winInfo.coins * 2, doubled: true });
    }
  };

  const exitToHome = async () => {
    await maybeShowInterstitial();
    router.back();
  };

  const usePower = (id: 'rowBlast' | 'laser' | 'slow') => {
    if (phaseRef.current !== 'aiming') return;
    if (!consumePowerUp(id)) return;
    const st = levelRef.current;
    if (id === 'rowBlast') {
      const maxRow = Math.max(...st.bricks.map((b) => b.row), -1);
      if (maxRow >= 0) {
        const removed = st.bricks.filter((b) => b.row === maxRow);
        for (const b of removed) {
          destroyedHp.current += b.hp;
          bricksThisGame.current += 1;
          recordEvent('bricksBroken', 1);
          if (b.type === 'coin') addCoins(5);
        }
        st.bricks = st.bricks.filter((b) => b.row !== maxRow);
        setTick((x) => x + 1);
      }
      haptic(Haptics.ImpactFeedbackStyle.Heavy);
    } else if (id === 'laser') {
      laserTurns.current = 3;
    } else {
      frozenNextTurn.current = true;
    }
  };

  // ------- render -------
  const st = levelRef.current;
  const palette = {
    steel: '#5c6b8a',
    explosive: colors.accent,
    coin: colors.gold,
    tri: colors.purple,
    scale: [colors.primary, colors.green, colors.purple, colors.orange, colors.accent],
  };

  const cost = CONTINUE_COSTS[Math.min(continueCount.current, CONTINUE_COSTS.length - 1)];
  const progressPct = Math.round((destroyedHp.current / initialHp.current) * 100);

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* HUD */}
      <View style={styles.hud}>
        <Pressable onPress={exitToHome} hitSlop={12} testID="btn-exit">
          <Feather name="x" size={24} color={colors.mutedForeground} />
        </Pressable>
        <View style={[styles.levelPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold' }}>
            LEVEL {level}
          </Text>
        </View>
        <CoinBadge coins={state.coins} />
      </View>

      {/* Power-up bar */}
      <View style={styles.powerBar}>
        {POWER_UPS.map((p) => {
          const count = state.powerUps[p.id] ?? 0;
          return (
            <Pressable
              key={p.id}
              testID={`power-${p.id}`}
              onPress={() => usePower(p.id)}
              disabled={count <= 0 || phase !== 'aiming'}
              style={[
                styles.powerBtn,
                {
                  backgroundColor: colors.card,
                  borderColor: count > 0 ? colors.primary : colors.border,
                  opacity: count > 0 && phase === 'aiming' ? 1 : 0.4,
                },
              ]}
            >
              <Feather name={p.icon as keyof typeof Feather.glyphMap} size={16} color={colors.primary} />
              <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>
                {count}
              </Text>
            </Pressable>
          );
        })}
        <View style={{ flex: 1 }} />
        <NeonButton
          small
          label={`+${REWARDED_EXTRA_BALLS} Balls`}
          icon="video"
          color={colors.accent}
          textColor="#fff"
          onPress={onExtraBalls}
          testID="btn-extra-balls"
        />
      </View>

      {/* Board */}
      <View
        ref={boardRef}
        style={[styles.board, { borderColor: colors.border }]}
        onLayout={(e) => {
          setBoard({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
          measureBoard();
        }}
        {...pan.panHandlers}
      >
        {layout ? (
          <>
            {/* danger line */}
            <View
              style={[
                styles.dangerLine,
                {
                  top: layout.gap + MAX_ROWS * (layout.brickH + layout.gap),
                  borderColor: colors.destructive,
                },
              ]}
            />
            {/* bricks */}
            {st.bricks.map((b) => {
              const r = brickRect(layout, b.row, b.col);
              const c = brickColor(b, palette);
              if (b.shape === 'tri' && b.tri) {
                // border-trick triangle; hp label sits at the right-angle corner
                const o = b.tri;
                const triStyle = {
                  width: 0,
                  height: 0,
                  borderTopWidth: o === 'tl' || o === 'tr' ? r.h : 0,
                  borderBottomWidth: o === 'bl' || o === 'br' ? r.h : 0,
                  borderLeftWidth: o === 'tr' || o === 'br' ? r.w : 0,
                  borderRightWidth: o === 'tl' || o === 'bl' ? r.w : 0,
                  borderTopColor: o === 'tl' || o === 'tr' ? c + '59' : 'transparent',
                  borderBottomColor: o === 'bl' || o === 'br' ? c + '59' : 'transparent',
                  borderLeftColor: 'transparent' as const,
                  borderRightColor: 'transparent' as const,
                };
                const labelPos = {
                  left: o === 'tl' || o === 'bl' ? 5 : undefined,
                  right: o === 'tr' || o === 'br' ? 5 : undefined,
                  top: o === 'tl' || o === 'tr' ? 2 : undefined,
                  bottom: o === 'bl' || o === 'br' ? 2 : undefined,
                };
                return (
                  <View
                    key={b.id}
                    style={{ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h }}
                  >
                    <View style={triStyle} />
                    <Text style={[styles.brickText, { color: c, position: 'absolute', ...labelPos }]}>
                      {b.hp}
                    </Text>
                  </View>
                );
              }
              return (
                <View
                  key={b.id}
                  style={[
                    styles.brick,
                    {
                      left: r.x,
                      top: r.y,
                      width: r.w,
                      height: r.h,
                      backgroundColor: c + '26',
                      borderColor: c,
                      shadowColor: c,
                    },
                  ]}
                >
                  {b.type === 'explosive' ? (
                    <Feather name="zap" size={12} color={c} />
                  ) : b.type === 'coin' ? (
                    <Feather name="dollar-sign" size={12} color={c} />
                  ) : null}
                  <Text style={[styles.brickText, { color: c }]}>{b.hp}</Text>
                </View>
              );
            })}
            {/* bonus balls */}
            {st.bonuses.map((bo) => {
              const c = bonusCenter(layout, bo.row, bo.col);
              return (
                <View
                  key={bo.id}
                  style={[
                    styles.bonus,
                    { left: c.x - 13, top: c.y - 13, borderColor: colors.green, shadowColor: colors.green },
                  ]}
                >
                  <View style={[styles.bonusInner, { backgroundColor: colors.green }]} />
                </View>
              );
            })}
            {/* aim guide: laser raycast — passes through breakable bricks,
                stops at unbreakable ones, shows the wall ricochet */}
            {phase === 'aiming' && aim
              ? (() => {
                  const path = computeAimPath(
                    layout,
                    launchX.current,
                    layout.boardH - BALL_RADIUS - 2,
                    aim.dx,
                    aim.dy,
                    st.bricks,
                    ballCountRef.current,
                    laserTurns.current > 0 ? 2 : 1,
                  );
                  const dots: React.ReactNode[] = [];
                  let k = 0;
                  for (let i = 0; i < path.points.length - 1; i++) {
                    const a = path.points[i];
                    const bp = path.points[i + 1];
                    const segLen = Math.hypot(bp.x - a.x, bp.y - a.y);
                    const n = Math.floor(segLen / 18);
                    for (let j = i === 0 ? 1 : 0; j <= n; j++) {
                      const tt = (j * 18) / segLen;
                      dots.push(
                        <View
                          key={k++}
                          style={[
                            styles.aimDot,
                            {
                              left: a.x + (bp.x - a.x) * tt - 3,
                              top: a.y + (bp.y - a.y) * tt - 3,
                              backgroundColor: skin.color,
                              opacity: i === 0 ? 0.95 : 0.55,
                            },
                          ]}
                        />,
                      );
                    }
                  }
                  const end = path.points[path.points.length - 1];
                  dots.push(
                    <View
                      key="end"
                      style={[
                        styles.aimEnd,
                        {
                          left: end.x - BALL_RADIUS,
                          top: end.y - BALL_RADIUS,
                          borderColor: path.blocked ? colors.accent : skin.color,
                        },
                      ]}
                    />,
                  );
                  return dots;
                })()
              : null}
            {/* flying balls + trails */}
            {ballsRef.current.map((b) =>
              b.active ? (
                <React.Fragment key={b.id}>
                  {trail.color ? (
                    <View
                      style={[
                        styles.trailDot,
                        {
                          left: b.x - b.vx * 0.016 - 4,
                          top: b.y - b.vy * 0.016 - 4,
                          backgroundColor: trail.color,
                        },
                      ]}
                    />
                  ) : null}
                  <View
                    style={[
                      styles.ball,
                      {
                        left: b.x - BALL_RADIUS,
                        top: b.y - BALL_RADIUS,
                        backgroundColor: skin.color,
                        shadowColor: skin.glow,
                      },
                    ]}
                  />
                </React.Fragment>
              ) : null,
            )}
            {/* launcher ball + count */}
            {phase === 'aiming' || phase === 'firing' ? (
              <View
                style={{
                  position: 'absolute',
                  left: launchX.current - BALL_RADIUS,
                  top: layout.boardH - BALL_RADIUS * 2 - 2,
                  alignItems: 'center',
                }}
              >
                <View
                  style={[
                    styles.ball,
                    { position: 'relative', left: 0, top: 0, backgroundColor: skin.color, shadowColor: skin.glow },
                  ]}
                />
              </View>
            ) : null}
            <View key={ballPulse} style={[styles.ballCount, { left: 8, bottom: 6 }]}>
              <Feather name="circle" size={12} color={skin.color} />
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 14 }}>
                ×{ballCount}
              </Text>
            </View>
          </>
        ) : null}
      </View>

      <Text
        style={{
          textAlign: 'center',
          color: colors.mutedForeground,
          fontSize: 12,
          paddingVertical: 6,
        }}
      >
        {phase === 'aiming' ? 'Touch where you want to shoot — drag below the ball to cancel' : ' '}
      </Text>

      {/* ---- Continue / Game over modal ---- */}
      <Modal visible={phase === 'gameover'} transparent animationType="fade">
        <View style={styles.modalWrap}>
          <View style={[styles.modal, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {showContinue ? (
              <>
                <Feather name="alert-triangle" size={40} color={colors.gold} />
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>So close!</Text>
                <Text style={{ color: colors.mutedForeground, textAlign: 'center' }}>
                  You destroyed {progressPct}% of this level.{'\n'}Continue and finish it?
                </Text>
                <NeonButton
                  label="Watch Ad to Continue"
                  icon="video"
                  color={colors.accent}
                  textColor="#fff"
                  onPress={onContinueAd}
                  testID="btn-continue-ad"
                  style={{ alignSelf: 'stretch' }}
                />
                <NeonButton
                  label={`Continue for ${cost} coins`}
                  icon="dollar-sign"
                  color={colors.gold}
                  disabled={state.coins < cost}
                  onPress={onContinueCoins}
                  testID="btn-continue-coins"
                  style={{ alignSelf: 'stretch' }}
                />
                <Pressable onPress={exitToHome} testID="btn-skip-continue">
                  <Text style={{ color: colors.mutedForeground, padding: 8 }}>Skip → Game Over</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Feather name="frown" size={40} color={colors.destructive} />
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Game Over</Text>
                <Text style={{ color: colors.mutedForeground, textAlign: 'center' }}>
                  Bricks broken: {bricksThisGame.current}
                </Text>
                <NeonButton
                  label="Try Again"
                  icon="refresh-cw"
                  onPress={() => {
                    router.replace('/game');
                  }}
                  style={{ alignSelf: 'stretch' }}
                />
                <Pressable onPress={exitToHome}>
                  <Text style={{ color: colors.mutedForeground, padding: 8 }}>Home</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ---- Win modal ---- */}
      <Modal visible={phase === 'won'} transparent animationType="fade">
        <View style={styles.modalWrap}>
          <View style={[styles.modal, { backgroundColor: colors.card, borderColor: colors.gold }]}>
            <Feather name="award" size={44} color={colors.gold} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Level {level} Clear!</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name="dollar-sign" size={18} color={colors.gold} />
              <Text style={{ color: colors.gold, fontFamily: 'Inter_700Bold', fontSize: 22 }}>
                +{winInfo?.coins ?? 0}
              </Text>
            </View>
            {!winInfo?.doubled ? (
              <NeonButton
                label="Watch Ad → 2x Rewards"
                icon="video"
                color={colors.accent}
                textColor="#fff"
                onPress={onDoubleCoins}
                testID="btn-double"
                style={{ alignSelf: 'stretch' }}
              />
            ) : (
              <Text style={{ color: colors.green, fontFamily: 'Inter_600SemiBold' }}>Doubled!</Text>
            )}
            <NeonButton
              label="Next Level"
              icon="chevrons-right"
              onPress={async () => {
                await maybeShowInterstitial();
                router.replace('/game');
              }}
              style={{ alignSelf: 'stretch' }}
            />
            <Pressable onPress={exitToHome}>
              <Text style={{ color: colors.mutedForeground, padding: 8 }}>Home</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  levelPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  powerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  powerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  board: {
    flex: 1,
    marginHorizontal: 8,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dangerLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.5,
  },
  brick: {
    position: 'absolute',
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 2,
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  brickText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  bonus: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.8,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  bonusInner: { width: 10, height: 10, borderRadius: 5 },
  aimDot: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
  aimEnd: {
    position: 'absolute',
    width: BALL_RADIUS * 2,
    height: BALL_RADIUS * 2,
    borderRadius: BALL_RADIUS,
    borderWidth: 2,
  },
  ball: {
    position: 'absolute',
    width: BALL_RADIUS * 2,
    height: BALL_RADIUS * 2,
    borderRadius: BALL_RADIUS,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  trailDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.4,
  },
  ballCount: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(3,5,15,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 14,
  },
  modalTitle: { fontSize: 22, fontFamily: 'Inter_700Bold' },
});
