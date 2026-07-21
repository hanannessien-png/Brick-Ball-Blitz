---
name: Game physics coupling
description: Invariants between ball speed, substeps, triangle collision threshold, and aim-guide raycast in Brick Blast Quest.
---

**Rule:** Per-substep ball travel (BALL_SPEED × dt / subSteps) must stay well below the triangle hypotenuse reflection window (~BALL_RADIUS × 1.2), or diagonal bounces silently degrade into wrong-axis rect bounces. If BALL_SPEED changes, re-check subSteps.

**Why:** Architect review caught balls penetrating past the diagonal threshold in one substep at speed 820 with 3 substeps; fixed by using 6 substeps.

**How to apply:** When tuning speed/physics, keep the guide raycast (`computeAimPath`) using the same contact test (`circleHitsBrick`) and a small march step (~2px) so the preview matches real ball outcomes. Also: `measureInWindow` is async — sample first touch coordinates inside its callback, not after calling it.
