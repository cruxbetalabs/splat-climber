import { Vec3 } from 'playcanvas';

export type FabrikJoint = Vec3;

/**
 * FABRIK solver for a chain of fixed-length bones.
 * joints[0] is the root (fixed), joints[n] is the end effector (moved to target).
 */
export const solveFabrik = (
  joints: FabrikJoint[],
  boneLengths: number[],
  target: Vec3,
  iterations = 8,
  tolerance = 0.001
): void => {
  const n = joints.length;
  if (n < 2) return;

  const totalLength = boneLengths.reduce((a, b) => a + b, 0);
  const root = joints[0];
  const dist = root.distance(target);

  if (dist > totalLength - tolerance) {
    const dir = new Vec3().sub2(target, root).normalize();
    let prev = root;
    for (let i = 0; i < n - 1; i++) {
      const next = new Vec3().copy(dir).mulScalar(boneLengths[i]).add(prev);
      joints[i + 1].copy(next);
      prev = next;
    }
    return;
  }

  const tmp = new Vec3();
  for (let iter = 0; iter < iterations; iter++) {
    joints[n - 1].copy(target);

    for (let i = n - 2; i >= 0; i--) {
      tmp.sub2(joints[i], joints[i + 1]).normalize().mulScalar(boneLengths[i]).add(joints[i + 1]);
      joints[i].copy(tmp);
    }

    joints[0].copy(root);

    for (let i = 0; i < n - 1; i++) {
      tmp.sub2(joints[i + 1], joints[i]).normalize().mulScalar(boneLengths[i]).add(joints[i]);
      joints[i + 1].copy(tmp);
    }

    if (joints[n - 1].distance(target) < tolerance) break;
  }
};
