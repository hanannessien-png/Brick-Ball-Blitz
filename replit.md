# Brick Blast Quest

A casual arcade brick-breaker mobile game (Expo/React Native) with an ad-monetization-ready architecture, coin economy, missions, spin wheel, daily rewards, and a shop.

## Run & Operate

- Workflow `artifacts/brick-blast-quest: expo` — Expo dev server (game)
- `pnpm --filter @workspace/brick-blast-quest run typecheck` — typecheck the game
- No backend used — all persistence is local via AsyncStorage (offline gameplay)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Game: Expo + expo-router, custom requestAnimationFrame game loop (no game engine lib)
- State: React context (`GameContext` for player/economy, `AdContext` for ads) + AsyncStorage

## Where things live

- `artifacts/brick-blast-quest/game/engine.ts` — pure game logic: level generation, difficulty curve, collision math
- `artifacts/brick-blast-quest/app/game.tsx` — gameplay screen with the frame loop (state in refs, React renders ~30fps)
- `artifacts/brick-blast-quest/constants/game.ts` — all tuning: economy prices, missions (daily/weekly/monthly), spin prizes, daily rewards, ad cadence
- `artifacts/brick-blast-quest/context/AdContext.tsx` — simulated ad layer (App Open/Rewarded/Interstitial/Banner) with production AdMob migration guide in the header comment
- `artifacts/brick-blast-quest/PUBLISHING.md` — real-ads wiring, APK/AAB build, Play Store checklist

## Architecture decisions

- Ads are simulated: Expo Go can't load native AdMob SDK. All placements route through `AdContext` so production swap is one file.
- Continue offer only appears when player destroyed ≥40% of level (near-win monetization design, per user spec).
- Interstitials every 2 finished games, never during gameplay. Banners on menu screens only.
- Physics runs in refs inside rAF loop; React state tick at ~30fps mirrors it for rendering (Views, no canvas).

## Product

- Drag-to-aim ball shooter: bricks descend per turn, lose when they reach bottom.
- Brick types: numbered HP, Steel (3x HP), Explosive (splash damage), Coin, plus bonus-ball pickups.
- Economy: 100 starting coins; escalating Continue costs (50/100/150/250/400); win reward 20 + 5×level, ad-doubleable.
- Retention: 7-day daily reward streak, ad-gated spin wheel, 12 daily + 8 weekly + 6 monthly missions.
- Shop: 5 ball skins, 4 trails, 3 power-ups (Row Blast, Laser Aim, Freeze).

## User preferences

- English-only UI. User communicates in English/Arabic.
- Wants aggressive-but-policy-safe ad monetization and MANY missions (daily/weekly/monthly).

## Gotchas

- Game difficulty/economy tuning lives in `constants/game.ts` and `game/engine.ts` — change knobs there, not in screens.
- Don't add banners or interstitials to `app/game.tsx` — gameplay must stay ad-free (design + policy).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
