# Splat Climber

> **⚠️ Incomplete — work in progress.** This project is paused mid-build. Core editor pieces exist but many features are missing or untested end-to-end. See [`TODO.md`](TODO.md) for what's done and what's next.

Interactive climbing **editor** over Gaussian splats with voxel collision and FABRIK puppeteering — not a full physics simulation.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000 and load:

1. **Splat** — `.ply`, `.compressed.ply`, or `.sog`
2. **Voxel JSON** + **Voxel BIN** — `scene.voxel.json` and `scene.voxel.bin` from SuperSplat / splat-transform
3. *(Optional)* **Annotations** — `.climb.json` from a previous session

## Current workflow (partial)

1. Load splat + collision files.
2. **Add grip** — click the wall to place holds.
3. Assign **LH / RH / LF / RF** in Start pose (or use **Pose limbs** to drag hands/feet onto grips).
4. **Pose puppet at grips** to fit the body.
5. **Set start from puppet** *(pelvis only today — limb save still TODO)*.
6. **Export .climb.json**.

## Stack

- [PlayCanvas Engine](https://playcanvas.com/) 2.19 (WebGPU-first, WebGL2 fallback)
- Voxel collision adapted from [supersplat-viewer](https://github.com/playcanvas/supersplat-viewer) (MIT)
- FABRIK IK for stick-figure limbs

## Docs

- [`TODO.md`](TODO.md) — status, done items, next steps
- [`schema/README.md`](schema/README.md) — `.climb.json` export format
- [`THOUGHTS.md`](THOUGHTS.md) — early design notes (draft, not authoritative)
