# Brick Blast Quest — Production & Publishing Guide

## 1. What's built

- Core loop: drag to aim, release to shoot, balls bounce, bricks descend each turn.
- Difficulty curve: levels 1–5 very easy, gentle ramp to 10, faster ramp after 10.
- Brick types: numbered (HP), Steel (3x HP), Explosive (damages neighbors), Coin (+5 coins), plus green Bonus Ball pickups.
- Economy: start with 100 coins; Continue costs escalate 50 → 100 → 150 → 250 → 400.
- Continue offered **only** when the player has destroyed ≥ 40% of the level (near-win frustration → ad conversion).
- Retention: daily rewards (7-day streak), Lucky Spin (always ad-gated), and daily / weekly / monthly missions.
- Shop: 5 ball skins, 4 trails, 3 power-ups.
- All progress saved locally (AsyncStorage) — fully offline gameplay.

## 2. Ad placements (all wired through `context/AdContext.tsx`)

| Placement | Trigger | Type |
|---|---|---|
| App Open | On launch | App Open ad |
| Continue after losing | "Watch Ad to Continue" | Rewarded |
| +5 Balls | Button during gameplay HUD | Rewarded |
| 2x Rewards | Win screen | Rewarded |
| Spin Wheel | Every spin | Rewarded |
| Between games | Every 2 finished games | Interstitial |
| Menu screens only | Home / Shop / Missions / Spin | Banner |

Ads never interrupt gameplay and rewarded ads are always optional.

## 3. Replacing test ads with real AdMob

The app currently uses a **simulated ad layer** (Expo Go cannot load native ad SDKs).
Full step-by-step instructions are in the header comment of `context/AdContext.tsx`:

1. Create an AdMob account + app at https://admob.google.com, create 4 ad units
   (App Open, Rewarded, Interstitial, Banner) for Android.
2. `npx expo install react-native-google-mobile-ads`
3. Add the plugin + your AdMob App ID to `app.json`.
4. Replace the simulated functions in `AdContext.tsx` with the SDK calls, and
   `<AdBanner />` internals with the real `<BannerAd />` component.
5. Keep Google's test unit IDs during development. Switch to real unit IDs only
   in the release build (showing real ads to yourself violates AdMob policy).

## 4. Building APK / AAB (Android)

> Note: Replit's built-in publish flow (Expo Launch) currently targets the iOS
> App Store. For Google Play, build locally on your machine:

1. Download the project (or push it to GitHub from Replit).
2. On your machine: `npm i -g eas-cli`, `npx eas login`.
3. `npx eas build:configure`
4. Test build (APK): `npx eas build -p android --profile preview`
5. Store build (AAB): `npx eas build -p android --profile production`
6. Download the artifact from expo.dev when the build finishes.

## 5. Play Store publishing checklist

1. Google Play Console account ($25 one-time).
2. Create the app → fill Store listing:
   - Title: "Brick Blast Quest – Ball Breaker" (SEO keywords: brick, blast, ball breaker)
   - Short description with keywords: "Smash bricks, bounce balls, blast your way through endless neon levels!"
   - Screenshots (phone + 7" tablet), feature graphic 1024×500, icon 512×512.
3. Content rating questionnaire (casual game, contains ads).
4. Data safety form: declare AdMob data collection (advertising ID).
5. Add "Contains ads" declaration.
6. Upload the AAB to a Closed testing track first → then Production.
7. Link AdMob app to the Play Store listing once live (improves fill rate).

## 6. Tuning knobs

- `constants/game.ts` — prices, continue costs, mission list, spin prizes, daily rewards, interstitial frequency, continue near-win threshold.
- `game/engine.ts` — difficulty curve (`baseHp`, `density`, `rowCount`), special brick odds, ball speed.
- `constants/colors.ts` — neon palette.
