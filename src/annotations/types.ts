export type Vec3 = [number, number, number];

export type LimbSlot = 'LH' | 'RH' | 'LF' | 'RF';

export type Grip = {
  id: string;
  voxel: Vec3;
  normal?: Vec3;
  offset?: Vec3;
  label?: string;
};

export type StartPose = {
  pelvis: Vec3;
  facing?: Vec3;
  limbs: Partial<Record<LimbSlot, string>>;
};

export type CollisionSnapshot = {
  voxelResolution: number;
  gridBounds: { min: Vec3; max: Vec3 };
};

export type SceneAnnotations = {
  version: 1;
  collision?: CollisionSnapshot;
  grips: Grip[];
  start: StartPose;
  meta?: Record<string, unknown>;
};

export type EditorMode = 'navigate' | 'add-grip' | 'pose-puppet';
