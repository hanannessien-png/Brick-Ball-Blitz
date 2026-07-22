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

## 3. AdMob — ALREADY WIRED, NOTHING TO CODE

Real AdMob is fully integrated. No code changes are needed before publishing:

- SDK installed: `react-native-google-mobile-ads`.
- App ID `ca-app-pub-6225158226956884~6953177308` is registered in `app.json`
  (plugin config).
- All 5 real unit ids live in `constants/ads.ts` (`ADMOB`): App Open,
  Interstitial, Rewarded, Banner.
- `context/AdContext.tsx` automatically picks the right mode:
  - **Replit preview / Expo Go** → simulated ads (native SDK can't load there).
  - **`preview` APK (for testing on your phone)** → real SDK with Google's
    TEST ids (protects the AdMob account from invalid-traffic flags).
  - **`production` AAB (the one you upload to Google Play)** → real SDK with
    YOUR real unit ids.
- EU consent (UMP form) is requested automatically before ads initialize.
- iOS note: only Android is configured. If you ever build for iOS, add an
  `iosAppId` to the plugin config in `app.json` first.

The Android package name is set in `app.json`: **`com.brickblastquest.game`**.
It becomes permanent after the first upload to Google Play — change it before
that if you prefer a different one.

## 4. Building APK / AAB (Android)

> Note: Replit's built-in publish flow (Expo Launch) currently targets the iOS
> App Store. For Google Play, build on your machine (free Expo account needed):

1. Download the project as zip (or push it to GitHub from Replit).
2. On your machine: install Node.js, then `npm i -g eas-cli` and `eas login`.
3. In the `artifacts/brick-blast-quest` folder (eas.json is already prepared):
   - Test build (APK to install on your phone):
     `eas build -p android --profile preview`
   - Store build (AAB for Google Play):
     `eas build -p android --profile production`
4. Download the file from the link EAS prints (expo.dev) when the build finishes.
5. The production AAB shows YOUR real ads automatically — nothing to switch.

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
