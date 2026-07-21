/**
 * Game configuration: economy, shop, missions, daily rewards, spin wheel.
 */

export const START_COINS = 100;
export const CONTINUE_COSTS = [50, 100, 150, 250, 400]; // escalating continue price
export const CONTINUE_MIN_PROGRESS = 0.4; // only offer continue when player destroyed >= 40% (near-win)
export const INTERSTITIAL_EVERY_N_GAMES = 2;
export const REWARDED_EXTRA_BALLS = 5;

export function winCoins(level: number): number {
  return 20 + level * 5;
}

// ---------------- Shop ----------------

export interface SkinDef {
  id: string;
  name: string;
  price: number;
  color: string;
  glow: string;
}

export const SKINS: SkinDef[] = [
  { id: 'classic', name: 'Classic', price: 0, color: '#ffffff', glow: '#9fd8ff' },
  { id: 'neon', name: 'Neon', price: 500, color: '#00e5ff', glow: '#00e5ff' },
  { id: 'fire', name: 'Fire', price: 800, color: '#ff6b35', glow: '#ff9f1c' },
  { id: 'electric', name: 'Electric', price: 1200, color: '#ffd60a', glow: '#fff59d' },
  { id: 'plasma', name: 'Plasma', price: 2000, color: '#ff2e97', glow: '#ff8ac2' },
];

export interface TrailDef {
  id: string;
  name: string;
  price: number;
  color: string | null;
}

export const TRAILS: TrailDef[] = [
  { id: 'none', name: 'No Trail', price: 0, color: null },
  { id: 'glow', name: 'Glow', price: 400, color: '#00e5ff' },
  { id: 'comet', name: 'Comet', price: 900, color: '#ffd60a' },
  { id: 'rainbow', name: 'Rainbow', price: 1500, color: '#ff2e97' },
];

export type PowerUpId = 'rowBlast' | 'laser' | 'slow';

export interface PowerUpDef {
  id: PowerUpId;
  name: string;
  price: number;
  icon: string; // Feather icon name
  description: string;
}

export const POWER_UPS: PowerUpDef[] = [
  { id: 'rowBlast', name: 'Row Blast', price: 150, icon: 'zap', description: 'Destroys the lowest row of bricks' },
  { id: 'laser', name: 'Laser Aim', price: 100, icon: 'crosshair', description: 'Extended aim guide for 3 turns' },
  { id: 'slow', name: 'Freeze', price: 120, icon: 'pause-circle', description: 'Bricks do not descend next turn' },
];

// ---------------- Daily rewards ----------------

export interface DailyRewardDef {
  day: number;
  coins: number;
  powerUp?: PowerUpId;
}

export const DAILY_REWARDS: DailyRewardDef[] = [
  { day: 1, coins: 50 },
  { day: 2, coins: 75 },
  { day: 3, coins: 100, powerUp: 'laser' },
  { day: 4, coins: 125 },
  { day: 5, coins: 150, powerUp: 'rowBlast' },
  { day: 6, coins: 200 },
  { day: 7, coins: 300, powerUp: 'slow' },
];

// ---------------- Spin wheel ----------------

export interface SpinPrize {
  id: string;
  label: string;
  coins?: number;
  powerUp?: PowerUpId;
  color: string;
}

export const SPIN_PRIZES: SpinPrize[] = [
  { id: 's1', label: '25', coins: 25, color: '#00e5ff' },
  { id: 's2', label: 'Laser', powerUp: 'laser', color: '#ff2e97' },
  { id: 's3', label: '50', coins: 50, color: '#ffd60a' },
  { id: 's4', label: 'Blast', powerUp: 'rowBlast', color: '#3dffb4' },
  { id: 's5', label: '100', coins: 100, color: '#b388ff' },
  { id: 's6', label: 'Freeze', powerUp: 'slow', color: '#ff9f1c' },
  { id: 's7', label: '200', coins: 200, color: '#00e5ff' },
  { id: 's8', label: '500!', coins: 500, color: '#ff2e97' },
];

// ---------------- Missions ----------------

export type MissionMetric =
  | 'bricksBroken'
  | 'gamesPlayed'
  | 'gamesWon'
  | 'powerUpsUsed'
  | 'coinsEarned'
  | 'ballsCollected'
  | 'spinsUsed'
  | 'adsWatched'
  | 'levelReached';

export type MissionPeriod = 'daily' | 'weekly' | 'monthly';

export interface MissionDef {
  id: string;
  period: MissionPeriod;
  metric: MissionMetric;
  target: number;
  reward: number; // coins
  title: string;
}

export const MISSIONS: MissionDef[] = [
  // ---- Daily (many, as requested) ----
  { id: 'd1', period: 'daily', metric: 'bricksBroken', target: 30, reward: 30, title: 'Break 30 bricks' },
  { id: 'd2', period: 'daily', metric: 'bricksBroken', target: 80, reward: 60, title: 'Break 80 bricks' },
  { id: 'd3', period: 'daily', metric: 'bricksBroken', target: 150, reward: 100, title: 'Break 150 bricks' },
  { id: 'd4', period: 'daily', metric: 'gamesPlayed', target: 2, reward: 25, title: 'Play 2 games' },
  { id: 'd5', period: 'daily', metric: 'gamesPlayed', target: 5, reward: 60, title: 'Play 5 games' },
  { id: 'd6', period: 'daily', metric: 'gamesWon', target: 1, reward: 40, title: 'Win a game' },
  { id: 'd7', period: 'daily', metric: 'gamesWon', target: 3, reward: 90, title: 'Win 3 games' },
  { id: 'd8', period: 'daily', metric: 'powerUpsUsed', target: 1, reward: 30, title: 'Use a power-up' },
  { id: 'd9', period: 'daily', metric: 'ballsCollected', target: 10, reward: 40, title: 'Collect 10 bonus balls' },
  { id: 'd10', period: 'daily', metric: 'coinsEarned', target: 100, reward: 40, title: 'Earn 100 coins' },
  { id: 'd11', period: 'daily', metric: 'spinsUsed', target: 1, reward: 25, title: 'Spin the wheel' },
  { id: 'd12', period: 'daily', metric: 'adsWatched', target: 2, reward: 50, title: 'Watch 2 reward videos' },

  // ---- Weekly ----
  { id: 'w1', period: 'weekly', metric: 'bricksBroken', target: 500, reward: 200, title: 'Break 500 bricks' },
  { id: 'w2', period: 'weekly', metric: 'bricksBroken', target: 1200, reward: 400, title: 'Break 1,200 bricks' },
  { id: 'w3', period: 'weekly', metric: 'gamesPlayed', target: 20, reward: 150, title: 'Play 20 games' },
  { id: 'w4', period: 'weekly', metric: 'gamesWon', target: 8, reward: 250, title: 'Win 8 games' },
  { id: 'w5', period: 'weekly', metric: 'powerUpsUsed', target: 10, reward: 200, title: 'Use 10 power-ups' },
  { id: 'w6', period: 'weekly', metric: 'coinsEarned', target: 1000, reward: 300, title: 'Earn 1,000 coins' },
  { id: 'w7', period: 'weekly', metric: 'spinsUsed', target: 5, reward: 150, title: 'Spin 5 times' },
  { id: 'w8', period: 'weekly', metric: 'ballsCollected', target: 60, reward: 200, title: 'Collect 60 bonus balls' },

  // ---- Monthly ----
  { id: 'm1', period: 'monthly', metric: 'bricksBroken', target: 3000, reward: 800, title: 'Break 3,000 bricks' },
  { id: 'm2', period: 'monthly', metric: 'gamesPlayed', target: 80, reward: 600, title: 'Play 80 games' },
  { id: 'm3', period: 'monthly', metric: 'gamesWon', target: 30, reward: 900, title: 'Win 30 games' },
  { id: 'm4', period: 'monthly', metric: 'levelReached', target: 25, reward: 1000, title: 'Reach level 25' },
  { id: 'm5', period: 'monthly', metric: 'coinsEarned', target: 5000, reward: 1200, title: 'Earn 5,000 coins' },
  { id: 'm6', period: 'monthly', metric: 'powerUpsUsed', target: 40, reward: 700, title: 'Use 40 power-ups' },
];

// Period keys used to auto-reset progress
export function periodKey(period: MissionPeriod, now: Date): string {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  if (period === 'daily') return `${y}-${m}-${d}`;
  if (period === 'monthly') return `${y}-${m}`;
  // ISO-ish week key
  const oneJan = new Date(y, 0, 1);
  const week = Math.ceil(((now.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);
  return `${y}-w${week}`;
}
