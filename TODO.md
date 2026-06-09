# TODO — Splat Climber

**Status:** Work in progress — not ready for production use. Paused here; revisit next session.

Interactive climbing **editor** over Gaussian splats (IK puppeteering, not physics simulation).

---

## Done

- [x] PlayCanvas bootstrap (WebGPU-first, WebGL2 fallback)
- [x] Load splat (`.ply`, `.compressed.ply`, `.sog`) via file picker
- [x] Load voxel collision (`scene.voxel.json` + `scene.voxel.bin`)
- [x] Orbit camera + WASD/QE pan
- [x] Add grip mode — click wall, voxel snap + surface normal
- [x] Grip list, selection, delete
- [x] Stick-figure puppet + FABRIK (2-bone limbs)
- [x] Start pose panel — LH/RH/LF/RF grip dropdowns
- [x] **Pose puppet at grips** — auto-fit pelvis from assigned grips
- [x] **Pose limbs** mode — drag hand/foot onto wall, release near grip to assign
- [x] Overlay render layer (puppet/grips draw after splat)
- [x] `.climb.json` import / export (schema v1)
- [x] Scene panel with filename + Replace per slot

---

## Next up (when we revisit)

### High priority

- [ ] **Set start from puppet** should save full pose (pelvis + limb→grip assignments), not just pelvis
- [ ] **Pose limbs polish** — clearer pick radius, highlight active limb, snap feedback on gizmos
- [ ] **Drag onto wall** — confirm voxel raycast feels good at steep angles; tune snap distance
- [ ] **Focus camera on selected grip**

### Medium priority

- [ ] Voxel collision debug overlay (toggle grid / wireframe)
- [ ] Pelvis reposition without moving limbs (secondary mode or gizmo)
- [ ] Grip editing — move/relabel in-scene
- [ ] Import `.climb.json` should restore puppet pose immediately

### Lower priority / later

- [ ] Timeline / keyframe poses between start and top
- [ ] Pose interpolation playback
- [ ] Walk / fly camera mode (SuperSplat-style navigation)
- [ ] `.splat` format support
- [ ] Bone / intermediate joint picking
- [ ] Full rigid-body climbing sim (explicitly out of scope for v1)

---

## Known gaps / bugs to verify

- [ ] Test with real scene: `mosaicbounty1.compressed.ply` + voxel pair
- [ ] Limb drag without nearby grip — free target is visual-only (not in export schema)
- [ ] Port 3000 vs 3001 if a stale dev server is left running
- [ ] Large splat load times — prefer `.compressed.ply`

---

## Dev

```bash
npm install
npm run dev
```

Open http://localhost:3000 (or next free port).
