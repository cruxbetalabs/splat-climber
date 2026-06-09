> THIS IS A DRAFT OF PROPOSAL, NOT REALLY RELIABLE TO REFERENCE. READ IT CAREFULLY and CAUTIOUSLY.

a small custom “climbing puppet over splat” editor, not a full physics simulation.

The approach:

```text
SuperSplat / PlayCanvas scene
→ Gaussian splat as visual background
→ generated voxel collision as walkable / coarse physical layer
→ manually placed hold/contact points
→ simple humanoid skeleton
→ FABRIK IK for arms and legs
→ keyframed beta poses
→ camera path render / screen recording
```

The important distinction is that the official SuperSplat collision layer is designed for **viewer navigation**: splats normally have no physical presence, and the voxel collision asset makes the scene walkable so the viewer/camera can collide against it. The docs describe it as a coarse, low-resolution box-based reconstruction separate from the splat, optimized for runtime physics rather than visual detail. ([developer.playcanvas.com][1])

For your experiment, I’d use that voxel collision only as the **coarse environment layer**. The climbing motion should still be driven by explicit hold points, because the voxel collision is not precise enough to infer “this is a crimp,” “this is a foot chip,” or “the left hand should grab here.”

A good web architecture would be:

```text
/scene
  load splat
  load voxel collision if available
  load annotations / hold points

/editor
  click on scene to place holds
  label: LH, RH, LF, RF, start, crux, top
  create key poses

/puppet
  simple skeleton
  FABRIK chains:
    shoulder → elbow → wrist
    hip → knee → ankle
  solve each limb toward assigned target

/timeline
  Pose 1: start
  Pose 2: right hand to crux
  Pose 3: left foot high
  Pose 4: top
```

FABRIK is a reasonable choice here because it is a fast iterative IK method, and it is commonly grouped with CCD as a low-cost heuristic IK solver. The classic reference is Aristidou and Lasenby’s 2011 “FABRIK: A fast, iterative solver for the inverse kinematics problem.” ([Wikipedia][2])

The MVP I’d build first:

```text
1. Use PlayCanvas or Three.js to render the splat.
2. Add editable 3D markers for holds.
3. Add a very simple stick-figure skeleton.
4. Implement FABRIK for 2-bone limbs.
5. Assign each hand/foot to a marker per pose.
6. Interpolate between poses.
7. Manually keyframe pelvis/chest position.
8. Render or screen-record the result.
```

I’d avoid full rigid-body simulation for now. A real simulated climber is much harder because you need grip constraints, friction, joint limits, center-of-mass control, and contact planning. For your video, **IK puppeteering** will look better faster.

My recommendation for platform:

| Option                           | Fit                                                                               |
| -------------------------------- | --------------------------------------------------------------------------------- |
| **PlayCanvas**                   | Best if you want to stay close to SuperSplat / collision / web viewer             |
| **Three.js + React Three Fiber** | Best if you want full custom control in Cursor                                    |
| **Babylon.js**                   | Good alternative with solid engine features, but less directly tied to SuperSplat |
| **Blender**                      | Better for offline animation, but not what you want right now                     |

Given you are already in SuperSplat and have walkable collision, I’d start with **PlayCanvas first**. Use the collision layer for navigation and spatial grounding, then build a lightweight editor for hold markers + FABRIK puppet movement on top.

[1]: https://developer.playcanvas.com/user-manual/supersplat/studio/collision/ "Collision | PlayCanvas Developer Site"
[2]: https://en.wikipedia.org/wiki/Inverse_kinematics?utm_source=chatgpt.com "Inverse kinematics"
