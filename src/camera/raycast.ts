import { Vec3, type CameraComponent } from 'playcanvas';

export const rayFromScreen = (
  camera: CameraComponent,
  sx: number,
  sy: number,
  outOrigin: Vec3,
  outDir: Vec3
): void => {
  const near = new Vec3();
  const far = new Vec3();
  camera.screenToWorld(sx, sy, camera.nearClip, near);
  camera.screenToWorld(sx, sy, camera.farClip, far);
  outOrigin.copy(near);
  outDir.sub2(far, near).normalize();
};

/** Intersect view ray with a horizontal plane at the given Y. */
export const raycastHorizontalPlane = (
  camera: CameraComponent,
  sx: number,
  sy: number,
  planeY: number,
  out: Vec3
): boolean => {
  const origin = new Vec3();
  const dir = new Vec3();
  rayFromScreen(camera, sx, sy, origin, dir);

  if (Math.abs(dir.y) < 1e-6) return false;

  const t = (planeY - origin.y) / dir.y;
  if (t < 0) return false;

  out.copy(dir).mulScalar(t).add(origin);
  return true;
};

/** Closest distance from a world point to a ray; returns ray parameter t (negative = behind origin). */
export const distancePointToRay = (
  origin: Vec3,
  dir: Vec3,
  point: Vec3,
  closest: Vec3
): { dist: number; t: number } => {
  const v = new Vec3().sub2(point, origin);
  const t = v.dot(dir);
  closest.copy(dir).mulScalar(t).add(origin);
  return { dist: point.distance(closest), t };
};
