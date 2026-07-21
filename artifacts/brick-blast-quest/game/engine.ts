/**
 * Pure game logic for Brick Blast Quest: level generation and collision math.
 * Rendering + the frame loop live in app/game.tsx.
 */

export const COLS = 7;
export const MAX_ROWS = 9; // brick reaching this row = game over
export const BALL_RADIUS = 7;
export const BALL_SPEED = 820; // px per second

export type BrickType = 'normal' | 'steel' | 'explosive' | 'coin';

export interface Brick {
  id: number;
  row: number;
  col: number;
  hp: number;
  maxHp: number;
  type: BrickType;
}

export interface BonusBall {
  id: number;
  row: number;
  col: number;
}

export interface LevelState {
  bricks: Brick[];
  bonuses: BonusBall[];
  queue: RowSpec[]; // rows still to spawn (one per turn)
  totalHp: number; // for progress calculation
}

export type RowSpec = { bricks: { col: number; hp: number; type: BrickType }[]; bonusCols: number[] };

let nextId = 1;
export function newId(): number {
  return nextId++;
}

// ---------------- Difficulty curve ----------------
// Levels 1-5: very easy. 6-10: gentle ramp. 11+: faster ramp.
function baseHp(level: number): number {
  if (level <= 5) return Math.max(1, Math.round(level * 0.7));
  if (level <= 10) return level - 2;
  return Math.round(8 + (level - 10) * 1.5);
}

function density(level: number): number {
  if (level <= 5) return 0.32;
  if (level <= 10) return 0.42;
  return Math.min(0.62, 0.45 + (level - 10) * 0.012);
}

function rowCount(level: number): number {
  if (level <= 3) return 4;
  if (level <= 8) return 5 + Math.floor(level / 4);
  return Math.min(14, 7 + Math.floor((level - 8) / 2));
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateRow(level: number): RowSpec {
  const d = density(level);
  const hp = baseHp(level);
  const bricks: RowSpec['bricks'] = [];
  const emptyCols: number[] = [];
  for (let c = 0; c < COLS; c++) {
    if (Math.random() < d) {
      const roll = Math.random();
      let type: BrickType = 'normal';
      let bhp = randInt(Math.max(1, Math.round(hp * 0.7)), Math.max(1, Math.round(hp * 1.3)));
      if (level > 3 && roll < 0.08) {
        type = 'explosive';
      } else if (level > 5 && roll < 0.14) {
        type = 'steel';
        bhp = bhp * 3;
      } else if (roll < 0.22) {
        type = 'coin';
      }
      bricks.push({ col: c, hp: bhp, type });
    } else {
      emptyCols.push(c);
    }
  }
  // Guarantee at least one brick per row
  if (bricks.length === 0) {
    const c = randInt(0, COLS - 1);
    bricks.push({ col: c, hp: Math.max(1, hp), type: 'normal' });
  }
  const bonusCols: number[] = [];
  if (emptyCols.length > 0 && Math.random() < 0.45) {
    bonusCols.push(emptyCols[randInt(0, emptyCols.length - 1)]);
  }
  return { bricks, bonusCols };
}

export function generateLevel(level: number): LevelState {
  const rows = rowCount(level);
  const queue: RowSpec[] = [];
  for (let i = 0; i < rows; i++) queue.push(generateRow(level));

  const state: LevelState = { bricks: [], bonuses: [], queue, totalHp: 0 };
  // Spawn first 3 rows immediately (rows 0..2 from top)
  const initial = Math.min(3, queue.length);
  for (let i = 0; i < initial; i++) {
    const spec = state.queue.shift()!;
    spawnRow(state, spec, initial - 1 - i);
  }
  state.totalHp = queue.reduce((s, r) => s + r.bricks.reduce((a, b) => a + b.hp, 0), 0)
    + state.bricks.reduce((a, b) => a + b.hp, 0);
  return state;
}

export function spawnRow(state: LevelState, spec: RowSpec, row = 0): void {
  for (const b of spec.bricks) {
    state.bricks.push({ id: newId(), row, col: b.col, hp: b.hp, maxHp: b.hp, type: b.type });
  }
  for (const c of spec.bonusCols) {
    state.bonuses.push({ id: newId(), row, col: c });
  }
}

/** Shift everything down one row, then spawn the next queued row at top. Returns true if a brick hit the floor. */
export function advanceTurn(state: LevelState, frozen: boolean): boolean {
  if (!frozen) {
    for (const b of state.bricks) b.row += 1;
    for (const bo of state.bonuses) bo.row += 1;
    // bonuses that reach bottom just disappear
    state.bonuses = state.bonuses.filter((b) => b.row < MAX_ROWS);
  }
  const next = state.queue.shift();
  if (next) spawnRow(state, next, 0);
  return state.bricks.some((b) => b.row >= MAX_ROWS);
}

// ---------------- Geometry ----------------

export interface Layout {
  boardW: number;
  boardH: number;
  brickW: number;
  brickH: number;
  gap: number;
}

export function makeLayout(boardW: number, boardH: number): Layout {
  const gap = 4;
  const brickW = (boardW - gap * (COLS + 1)) / COLS;
  const brickH = Math.min(44, (boardH * 0.72) / MAX_ROWS - gap);
  return { boardW, boardH, brickW, brickH, gap };
}

export function brickRect(l: Layout, row: number, col: number) {
  const x = l.gap + col * (l.brickW + l.gap);
  const y = l.gap + row * (l.brickH + l.gap);
  return { x, y, w: l.brickW, h: l.brickH };
}

export function bonusCenter(l: Layout, row: number, col: number) {
  const r = brickRect(l, row, col);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/**
 * Circle vs rect collision. Returns null if no hit, otherwise the axis to reflect on.
 */
export function circleRectHit(
  cx: number,
  cy: number,
  r: number,
  rect: { x: number; y: number; w: number; h: number },
): 'x' | 'y' | null {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx;
  const dy = cy - ny;
  if (dx * dx + dy * dy > r * r) return null;
  // Reflect on axis with least penetration
  const overlapX = r - Math.abs(dx);
  const overlapY = r - Math.abs(dy);
  if (Math.abs(dx) > Math.abs(dy)) return 'x';
  if (Math.abs(dy) > Math.abs(dx)) return 'y';
  return overlapX < overlapY ? 'x' : 'y';
}

export function brickColor(b: Brick, palette: { steel: string; explosive: string; coin: string; scale: string[] }): string {
  if (b.type === 'steel') return palette.steel;
  if (b.type === 'explosive') return palette.explosive;
  if (b.type === 'coin') return palette.coin;
  // color by hp tier
  const t = Math.min(palette.scale.length - 1, Math.floor((b.hp - 1) / 4));
  return palette.scale[t];
}
