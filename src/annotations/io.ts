import type { VoxelCollision } from '../collision';
import type { CollisionSnapshot, Grip, SceneAnnotations, StartPose, Vec3 } from './types';

export const gripWorldPosition = (
  collision: VoxelCollision,
  grip: Grip
): Vec3 => {
  const res = collision.voxelResolution;
  const offset = grip.offset ?? [0, 0, 0];
  return [
    collision.gridMinX + (grip.voxel[0] + 0.5) * res + offset[0],
    collision.gridMinY + (grip.voxel[1] + 0.5) * res + offset[1],
    collision.gridMinZ + (grip.voxel[2] + 0.5) * res + offset[2]
  ];
};

export const worldToVoxel = (
  collision: VoxelCollision,
  x: number,
  y: number,
  z: number
): Vec3 => {
  const res = collision.voxelResolution;
  return [
    Math.floor((x - collision.gridMinX) / res),
    Math.floor((y - collision.gridMinY) / res),
    Math.floor((z - collision.gridMinZ) / res)
  ];
};

export const collisionSnapshot = (collision: VoxelCollision): CollisionSnapshot => {
  const res = collision.voxelResolution;
  return {
    voxelResolution: res,
    gridBounds: {
      min: [collision.gridMinX, collision.gridMinY, collision.gridMinZ],
      max: [
        collision.gridMinX + collision.numVoxelsX * res,
        collision.gridMinY + collision.numVoxelsY * res,
        collision.gridMinZ + collision.numVoxelsZ * res
      ]
    }
  };
};

export const validateCollisionSnapshot = (
  loaded: CollisionSnapshot,
  current: CollisionSnapshot
): string | null => {
  const eps = 1e-4;
  if (Math.abs(loaded.voxelResolution - current.voxelResolution) > eps) {
    return `Voxel resolution mismatch (file: ${loaded.voxelResolution}, scene: ${current.voxelResolution})`;
  }
  for (let i = 0; i < 3; i++) {
    if (Math.abs(loaded.gridBounds.min[i] - current.gridBounds.min[i]) > eps ||
        Math.abs(loaded.gridBounds.max[i] - current.gridBounds.max[i]) > eps) {
      return 'Grid bounds mismatch — collision may have been regenerated.';
    }
  }
  return null;
};

export const exportAnnotations = (
  grips: Grip[],
  start: StartPose,
  collision: VoxelCollision | null
): SceneAnnotations => ({
  version: 1,
  collision: collision ? collisionSnapshot(collision) : undefined,
  grips,
  start
});

export const parseAnnotations = (json: unknown): SceneAnnotations => {
  const data = json as SceneAnnotations;
  if (data?.version !== 1 || !Array.isArray(data.grips) || !data.start) {
    throw new Error('Invalid .climb.json (expected version 1 with grips and start)');
  }
  return data;
};

export const nextGripId = (grips: Grip[]): string => {
  let n = grips.length + 1;
  const ids = new Set(grips.map(g => g.id));
  while (ids.has(`grip_${n}`)) n++;
  return `grip_${n}`;
};

export const defaultStart = (): StartPose => ({
  pelvis: [0, 1, 0],
  facing: [0, 0, -1],
  limbs: {}
});
