---
name: EAS build pnpm pin
description: Why eas.json pins pnpm and where EAS builds must be started from in this monorepo
---
EAS Android builds must use pnpm 10.26.1 (pinned via `"pnpm"` in each eas.json build profile).

**Why:** the workspace keeps `overrides` in pnpm-workspace.yaml. pnpm 9.x and early 10.x ignore that, so `pnpm install --frozen-lockfile` fails with ERR_PNPM_LOCKFILE_CONFIG_MISMATCH even though the lockfile is correct. Reproduced locally on 2026-10-16 (9.15.9 and 10.0.0 fail, 10.26.1 passes).

**How to apply:** if the Replit pnpm version changes and the lockfile gets regenerated, bump the eas.json pin and the root `packageManager` to match. Builds must be started from artifacts/brick-blast-quest. The repo root has a stray app.json/eas.json (package com.hanan.dog) left by an earlier publish, and it isn't this game.
