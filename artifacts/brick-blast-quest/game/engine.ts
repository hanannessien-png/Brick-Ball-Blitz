/**
 * Pure game logic for Brick Blast Quest: level generation, collision math,
 * and the aim-guide raycast. Rendering + the frame loop live in app/game.tsx.
 */

export const COLS = 7;
export const MAX_ROWS = 9; // brick reaching this row = game over
export const BALL_RADIUS = 7;
export const BALL_SPEED = 820; // px per second

export type BrickType = 'normal' | 'steel' | 'explosive' | 'coin';
export type BrickShape = 'rect' | 'tri';
/** Which corner holds the right angle; the hypotenuse faces the opposite corner. */
export type TriOrient = 'tl' | 'tr' | 'bl' | 'br';

export interface Brick {
  id: number;
  row: number;
  col: number;
  hp: number;
  maxHp: number;
  type: BrickType;
  shape: BrickShape;
  tri?: TriOrient;
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

export type RowSpec = {
  bricks: { col: number; hp: number; type: BrickType; shape: BrickShape; tri?: TriOrient }[];
  bonusCols: number[];
};

let nextId = 1;
export function newId(): number {
  return nextId++;
}

// ---------------- Difficulty curve ----------------
// Noticeably challenging from level 1, ramps quickly after 10.
function baseHp(level: number): number {
  if (level <= 3) return level + 1; // 2..4
  if (level <= 10) return Math.round(level * 1.6); // ~6..16
  return Math.round(16 + (level - 10) * 2.2);
}

function density(level: number): number {
  if (level <= 3) return 0.42;
  if (level <= 10) return 0.5;
  return Math.min(0.72, 0.52 + (level - 10) * 0.015);
}

function rowCount(level: number): number {
  if (level <= 3) return 5;
  if (level <= 8) return 6 + Math.floor(level / 4);
  return Math.min(16, 8 + Math.floor((level - 8) / 2));
}

/** Triangle bricks appear starting at this level. */
export const TRIANGLE_MIN_LEVEL = 10;

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const TRI_ORIENTS: TriOrient[] = ['tl', 'tr', 'bl', 'br'];

export function generateRow(level: number): RowSpec {
  const d = density(level);
  const hp = baseHp(level);
  const bricks: RowSpec['bricks'] = [];
  const emptyCols: number[] = [];
  for (let c = 0; c < COLS; c++) {
    if (Math.random() < d) {
      const roll = Math.random();
      let type: BrickType = 'normal';
      let shape: BrickShape = 'rect';
      let tri: TriOrient | undefined;
      let bhp = randInt(Math.max(1, Math.round(hp * 0.7)), Math.max(1, Math.round(hp * 1.3)));
      if (level > 3 && roll < 0.08) {
        type = 'explosive';
      } else if (level > 5 && roll < 0.14) {
        type = 'steel';
        bhp = bhp * 3;
      } else if (roll < 0.22) {
        type = 'coin';
      } else if (level >= TRIANGLE_MIN_LEVEL && roll < 0.44) {
        // Triangles: tougher than squares (bigger numbers), diagonal bounce.
        shape = 'tri';
        tri = TRI_ORIENTS[randInt(0, 3)];
        bhp = Math.round(bhp * 1.7);
      }
      bricks.push({ col: c, hp: bhp, type, shape, tri });
    } else {
      emptyCols.push(c);
    }
  }
  // Guarantee at least one brick per row
  if (bricks.length === 0) {
    const c = randInt(0, COLS - 1);
    bricks.push({ col: c, hp: Math.max(1, hp), type: 'normal', shape: 'rect' });
  }
  const bonusCols: number[] = [];
  if (emptyCols.length > 0 && Math.random() < 0.4) {
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
    state.bricks.push({
      id: newId(),
      row,
      col: b.col,
      hp: b.hp,
      maxHp: b.hp,
      type: b.type,
      shape: b.shape,
      tri: b.tri,
    });
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
 * Signed distance (px) of point from the triangle's hypotenuse.
 * Positive = outside the triangle (in the empty corner), negative = inside.
 */
function triHypDist(
  o: TriOrient,
  rect: { x: number; y: number; w: number; h: number },
  px: number,
  py: number,
): number {
  const dx = px - rect.x;
  const dy = py - rect.y;
  const L = Math.sqrt(rect.w * rect.w + rect.h * rect.h);
  switch (o) {
    case 'tl': // occupies u+v<=1; outside when f>0
      return (rect.h * dx + rect.w * dy - rect.w * rect.h) / L;
    case 'tr': // occupies v<=u; inside f>=0
      return -(rect.h * dx - rect.w * dy) / L;
    case 'bl': // occupies v>=u; inside f<=0
      return (rect.h * dx - rect.w * dy) / L;
    case 'br': // occupies u+v>=1; inside f>=0
      return -(rect.h * dx + rect.w * dy - rect.w * rect.h) / L;
  }
}

/** Outward unit normal of the hypotenuse (points from triangle into the empty corner). */
export function triNormal(o: TriOrient, rect: { w: number; h: number }): { x: number; y: number } {
  const L = Math.sqrt(rect.w * rect.w + rect.h * rect.h);
  switch (o) {
    case 'tl':
      return { x: rect.h / L, y: rect.w / L };
    case 'tr':
      return { x: -rect.h / L, y: rect.w / L };
    case 'bl':
      return { x: rect.h / L, y: -rect.w / L };
    case 'br':
      return { x: -rect.h / L, y: -rect.w / L };
  }
}

/** Does a circle at (cx,cy) with radius r touch this brick (rect or triangle)? */
export function circleHitsBrick(
  l: Layout,
  brick: Brick,
  cx: number,
  cy: number,
  r: number,
): boolean {
  const rect = brickRect(l, brick.row, brick.col);
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx;
  const dy = cy - ny;
  if (dx * dx + dy * dy > r * r) return false;
  if (brick.shape === 'tri' && brick.tri) {
    // ignore contact in the empty corner
    if (triHypDist(brick.tri, rect, cx, cy) > r) return false;
  }
  return true;
}

export type Reflection = { kind: 'x' | 'y' | 'diag'; nx?: number; ny?: number };

/**
 * Compute how a ball moving (vx,vy) should reflect off a brick it touches.
 * Triangles reflect diagonally off their sloped edge; rects reflect on an axis.
 * Returns null if there is no contact.
 */
export function collideBrick(
  l: Layout,
  brick: Brick,
  cx: number,
  cy: number,
  r: number,
  vx: number,
  vy: number,
): Reflection | null {
  const rect = brickRect(l, brick.row, brick.col);
  const nxp = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const nyp = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nxp;
  const dy = cy - nyp;
  if (dx * dx + dy * dy > r * r) return null;

  if (brick.shape === 'tri' && brick.tri) {
    const s = triHypDist(brick.tri, rect, cx, cy);
    if (s > r) return null; // empty corner — no contact
    if (s > -r * 1.2) {
      // near the sloped edge → diagonal bounce (only if moving into it)
      const n = triNormal(brick.tri, rect);
      if (vx * n.x + vy * n.y < 0) return { kind: 'diag', nx: n.x, ny: n.y };
    }
  }
  // axis reflection (flat sides)
  if (Math.abs(dx) > Math.abs(dy)) return { kind: 'x' };
  if (Math.abs(dy) > Math.abs(dx)) return { kind: 'y' };
  return { kind: r - Math.abs(dx) < r - Math.abs(dy) ? 'x' : 'y' };
}

export function brickColor(b: Brick, palette: { steel: string; explosive: string; coin: string; tri: string; scale: string[] }): string {
  if (b.type === 'steel') return palette.steel;
  if (b.type === 'explosive') return palette.explosive;
  if (b.type === 'coin') return palette.coin;
  if (b.shape === 'tri') return palette.tri;
  // color by hp tier
  const t = Math.min(palette.scale.length - 1, Math.floor((b.hp - 1) / 4));
  return palette.scale[t];
}

// ---------------- Aim guide raycast ----------------

export interface AimPath {
  /** Segment vertices: start, wall-bounce points, end. */
  points: { x: number; y: number }[];
  /** True if the guide ended on a brick it cannot break through. */
  blocked: boolean;
}

/**
 * March a ray from the launch ball in direction (dx,dy), reflecting off the
 * side/top walls (showing the ricochet, like the original game). The guide
 * passes THROUGH bricks the current ball count can destroy (hp <= balls) and
 * STOPS at the first brick it cannot break (hp > balls).
 */
export function computeAimPath(
  l: Layout,
  sx: number,
  sy: number,
  dx: number,
  dy: number,
  bricks: Brick[],
  balls: number,
  maxBounces = 1,
): AimPath {
  const points: { x: number; y: number }[] = [{ x: sx, y: sy }];
  let x = sx;
  let y = sy;
  let vx = dx;
  let vy = dy;
  let bounces = 0;
  let traveled = 0;
  // Fine march step so the guide uses (nearly) the same contact resolution as
  // the physics loop and can't skip narrow gaps the ball would hit.
  const step = 2;
  const maxLen = l.boardH * (1 + maxBounces) * 1.1;
  const r = BALL_RADIUS;

  while (traveled < maxLen) {
    x += vx * step;
    y += vy * step;
    traveled += step;

    let bounced = false;
    if (x < r) {
      x = r;
      vx = Math.abs(vx);
      bounced = true;
    } else if (x > l.boardW - r) {
      x = l.boardW - r;
      vx = -Math.abs(vx);
      bounced = true;
    }
    if (y < r) {
      y = r;
      vy = Math.abs(vy);
      bounced = true;
    }
    if (y > l.boardH - r) break; // went below launch line

    if (bounced) {
      points.push({ x, y });
      bounces += 1;
      if (bounces > maxBounces) return { points, blocked: false };
      continue;
    }

    for (const b of bricks) {
      if (b.hp <= 0) continue;
      if (!circleHitsBrick(l, b, x, y, r)) continue;
      if (b.hp > balls) {
        // cannot break through → guide stops here
        points.push({ x, y });
        return { points, blocked: true };
      }
      // breakable → laser passes through, keep marching
    }
  }
  points.push({ x, y });
  return { points, blocked: false };
}
