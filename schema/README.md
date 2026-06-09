# Scene annotations export format

Optional JSON export for grip points and the puppet start pose. Users author everything in the scene first; this file is only for save/load.

**Suggested extension:** `.climb.json`

## Load order

1. Splat (`.ply`, `.sog`, …)
2. Voxel collision (`scene.voxel.json` + `scene.voxel.bin`)
3. Annotations (`.climb.json`) — optional

## Grip world position

Given loaded voxel metadata:

```text
cellCenter = gridBounds.min + (voxel + 0.5) * voxelResolution
worldPos   = cellCenter + offset
```

`normal` is the outward rock face at placement time (from the pick ray). Use it for hand orientation when a limb is assigned to that grip.

## Import validation

If `collision` is present, compare `voxelResolution` and `gridBounds` to the loaded `scene.voxel.json`. Mismatch → warn; grips may be wrong after regeneration.

## Start pose

- `pelvis` — stick-figure root in world meters (PlayCanvas space).
- `facing` — unit vector on the horizontal plane; pelvis yaw follows this.
- `limbs` — which grip id each end effector starts on. Omitted slots are free.

## Files

| File | Purpose |
|------|---------|
| `scene-annotations.schema.json` | JSON Schema (v1) |
| `example.climb.json` | Minimal valid example |
