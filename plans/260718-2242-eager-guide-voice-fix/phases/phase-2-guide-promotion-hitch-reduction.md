---
phase: 2
title: "Guide Promotion Hitch Reduction"
status: completed
plan: 260718-2242-eager-guide-voice-fix
created: 2026-07-18
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Phase 2 — Guide Promotion Hitch Reduction

## Overview
Keep eager guide loading, but reduce the visible hitch when fallback guide/player are swapped for the animated versions. Reuse the current `modelRegistry` cache and the existing `promoteAnimatedCharacters()` seam instead of adding a new scheduler subsystem.

## Files
**Modify**
- `apps/web/src/main.js`
- optionally `apps/web/src/media/model-registry.js` only if a tiny preload helper is required for clarity/reuse
- focused tests updated in phase 1 if source assertions need one extra guard

## TDD
- **Tests-before (RED)**
  - Add or extend a focused source/runtime test that proves guide promotion still happens immediately after bootstrap but no longer performs all swap work in a single monolithic synchronous block.
- **Implement**
  - Prewarm eager guide roles right after manifest-ready bootstrap.
  - Break promotion into staged steps (load/cache, build player, build guide, final swap/remove fallback).
  - Keep fallback meshes until the last successful swap step.
- **Tests-after**
  - Run the focused new/updated test plus `npm run build`.

## Success
- [x] Guide assets still start loading eagerly after media bootstrap.
- [x] Fallback-to-animated swap is staged through smaller steps instead of one large synchronous block.
- [x] No change broadens eager loading to scene props or video.

## Risks
- Animation/state refs in `tourManager` drift if swap ordering changes.
- Over-engineering this seam into a generic preload scheduler.
