import { Vec3, type CameraComponent } from 'playcanvas';

import type { VoxelCollision } from '../collision';
import { worldToVoxel } from '../annotations/io';

export type RayPickResult = {
  point: Vec3;
  voxel: [number, number, number];
  normal: [number, number, number];
};

export const pickVoxelSurface = (
  camera: CameraComponent,
  collision: VoxelCollision,
  canvasX: number,
  canvasY: number,
  canvasWidth: number,
  canvasHeight: number
): RayPickResult | null => {
  const origin = new Vec3();
  const direction = new Vec3();
  camera.screenToWorld(canvasX, canvasY, camera.farClip, origin);
  const near = new Vec3();
  camera.screenToWorld(canvasX, canvasY, camera.nearClip, near);
  direction.sub2(origin, near).normalize();

  const hit = collision.queryRay(
    near.x, near.y, near.z,
    direction.x, direction.y, direction.z,
    200
  );

  if (!hit) return null;

  const point = new Vec3(hit.x, hit.y, hit.z);
  const normal = collision.querySurfaceNormal(
    hit.x, hit.y, hit.z,
    -direction.x, -direction.y, -direction.z
  );

  const voxel = worldToVoxel(collision, hit.x, hit.y, hit.z);

  return {
    point,
    voxel,
    normal: [normal.nx, normal.ny, normal.nz]
  };
};

export const frameSceneBounds = (
  collision: VoxelCollision
): { center: Vec3; radius: number } => {
  const res = collision.voxelResolution;
  const minX = collision.gridMinX;
  const minY = collision.gridMinY;
  const minZ = collision.gridMinZ;
  const maxX = minX + collision.numVoxelsX * res;
  const maxY = minY + collision.numVoxelsY * res;
  const maxZ = minZ + collision.numVoxelsZ * res;

  const center = new Vec3(
    (minX + maxX) * 0.5,
    (minY + maxY) * 0.5,
    (minZ + maxZ) * 0.5
  );
  const radius = Math.max(maxX - minX, maxY - minY, maxZ - minZ) * 0.6;
  return { center, radius };
};
