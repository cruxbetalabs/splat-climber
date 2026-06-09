import {
  createCylinder,
  createSphere,
  Entity,
  MeshInstance,
  Quat,
  Vec3,
  type AppBase,
  type CameraComponent,
  type StandardMaterial
} from 'playcanvas';

import { solveFabrik } from './fabrik';
import type { Grip, LimbSlot, StartPose, Vec3 as Tuple3 } from '../annotations/types';
import type { VoxelCollision } from '../collision';
import { gripWorldPosition } from '../annotations/io';
import { distancePointToRay, rayFromScreen } from '../camera/raycast';

const LIMB_SLOTS: LimbSlot[] = ['LH', 'RH', 'LF', 'RF'];

const LIMB_BONES = {
  LH: [0.28, 0.26] as [number, number],
  RH: [0.28, 0.26] as [number, number],
  LF: [0.42, 0.42] as [number, number],
  RF: [0.42, 0.42] as [number, number]
};

const SHOULDER_OFFSET = new Vec3(-0.18, 0.22, 0);
const SHOULDER_OFFSET_R = new Vec3(0.18, 0.22, 0);
const HIP_OFFSET_L = new Vec3(-0.12, -0.02, 0);
const HIP_OFFSET_R = new Vec3(0.12, -0.02, 0);

type LimbChain = {
  slot: LimbSlot;
  joints: Vec3[];
  boneLengths: number[];
  spheres: Entity[];
  bones: Entity[];
};

const createJoint = (
  app: AppBase,
  material: StandardMaterial,
  scale: number
): Entity => {
  const entity = new Entity('joint');
  const mesh = createSphere(app.graphicsDevice, { radius: 1 });
  entity.addComponent('render', {
    meshInstances: [new MeshInstance(mesh, material)]
  });
  entity.setLocalScale(scale, scale, scale);
  return entity;
};

const createBone = (app: AppBase, material: StandardMaterial): Entity => {
  const entity = new Entity('bone');
  const mesh = createCylinder(app.graphicsDevice, { radius: 1, height: 1 });
  entity.addComponent('render', {
    meshInstances: [new MeshInstance(mesh, material)]
  });
  return entity;
};

const orientBone = (entity: Entity, a: Vec3, b: Vec3, thickness: number): void => {
  const len = a.distance(b);
  if (len < 0.001) {
    entity.enabled = false;
    return;
  }
  entity.enabled = true;
  const dir = new Vec3().sub2(b, a).normalize();
  const mid = new Vec3().add2(a, b).mulScalar(0.5);
  const rot = new Quat().setFromDirections(Vec3.UP, dir);
  entity.setPosition(mid);
  entity.setRotation(rot);
  entity.setLocalScale(thickness, len, thickness);
};

class Puppet {
  readonly root: Entity;

  private readonly pelvis = new Vec3();
  private facing = new Vec3(0, 0, -1);
  private limbTargets = new Map<LimbSlot, Vec3>();
  private chains: LimbChain[] = [];
  private chest = new Vec3();
  private pelvisMarker!: Entity;
  private spineBone!: Entity;

  constructor(
    app: AppBase,
    parent: Entity,
    jointMaterial: StandardMaterial,
    endMaterial: StandardMaterial,
    boneMaterial: StandardMaterial
  ) {
    this.root = new Entity('puppet');
    parent.addChild(this.root);

    for (const slot of LIMB_SLOTS) {
      const bones = LIMB_BONES[slot];
      const joints = [new Vec3(), new Vec3(), new Vec3()];
      const spheres = joints.map((_, i) => {
        const e = createJoint(app, i === 2 ? endMaterial : jointMaterial, i === 2 ? 0.09 : 0.07);
        e.name = `${slot}_${i}`;
        this.root.addChild(e);
        return e;
      });
      const boneEntities = [0, 1].map((i) => {
        const e = createBone(app, boneMaterial);
        e.name = `${slot}_bone_${i}`;
        this.root.addChild(e);
        return e;
      });
      this.chains.push({ slot, joints, boneLengths: [...bones], spheres, bones: boneEntities });
    }

    this.pelvisMarker = createJoint(app, jointMaterial, 0.1);
    this.pelvisMarker.name = 'pelvis';
    this.root.addChild(this.pelvisMarker);

    const chestEntity = createJoint(app, jointMaterial, 0.08);
    chestEntity.name = 'chest';
    this.root.addChild(chestEntity);

    this.spineBone = createBone(app, boneMaterial);
    this.spineBone.name = 'spine';
    this.root.addChild(this.spineBone);

    app.on('update', () => this.update());
  }

  applyStart(start: StartPose, collision: VoxelCollision | null, grips: Grip[]): void {
    this.pelvis.set(start.pelvis[0], start.pelvis[1], start.pelvis[2]);
    if (start.facing) {
      this.facing.set(start.facing[0], start.facing[1], start.facing[2]).normalize();
    }

    this.limbTargets.clear();
    if (collision) {
      const gripMap = new Map(grips.map(g => [g.id, g]));
      for (const slot of LIMB_SLOTS) {
        const gripId = start.limbs[slot];
        if (!gripId) continue;
        const grip = gripMap.get(gripId);
        if (!grip) continue;
        const w = gripWorldPosition(collision, grip);
        this.limbTargets.set(slot, new Vec3(w[0], w[1], w[2]));
      }
    }
    this.syncVisuals();
  }

  /** Place pelvis in front of assigned grips so IK reaches naturally. */
  fitPelvisFromGrips(collision: VoxelCollision, grips: Grip[], limbs: StartPose['limbs']): void {
    const assigned = LIMB_SLOTS.filter((s) => limbs[s]);
    if (assigned.length === 0) return;

    let cx = 0;
    let cy = 0;
    let cz = 0;
    let nx = 0;
    let ny = 0;
    let nz = 0;
    let normals = 0;

    for (const slot of assigned) {
      const grip = grips.find(g => g.id === limbs[slot]);
      if (!grip) continue;
      const w = gripWorldPosition(collision, grip);
      cx += w[0];
      cy += w[1];
      cz += w[2];
      if (grip.normal) {
        nx += grip.normal[0];
        ny += grip.normal[1];
        nz += grip.normal[2];
        normals++;
      }
    }

    const n = assigned.length;
    cx /= n;
    cy /= n;
    cz /= n;

    if (normals > 0) {
      const inv = 1 / normals;
      nx *= inv;
      ny *= inv;
      nz *= inv;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      this.pelvis.set(cx + nx * 0.45, cy - 0.55, cz + nz * 0.45);
      this.facing.set(-nx, 0, -nz).normalize();
    } else {
      this.pelvis.set(cx, cy - 0.55, cz + 0.35);
      this.facing.set(0, 0, -1);
    }
  }

  getPelvis(): Tuple3 {
    return [this.pelvis.x, this.pelvis.y, this.pelvis.z];
  }

  setPelvis(x: number, y: number, z: number): void {
    this.pelvis.set(x, y, z);
    this.syncVisuals();
  }

  nudgePelvisY(dy: number): void {
    this.pelvis.y += dy;
    this.syncVisuals();
  }

  /** Pick the nearest hand/foot end effector under the cursor. */
  pickEndEffector(
    camera: CameraComponent,
    sx: number,
    sy: number,
    pickRadius = 0.2
  ): LimbSlot | null {
    const origin = new Vec3();
    const dir = new Vec3();
    const closest = new Vec3();
    rayFromScreen(camera, sx, sy, origin, dir);

    let best: { slot: LimbSlot; dist: number } | null = null;

    for (const chain of this.chains) {
      const pos = chain.spheres[2].getPosition();
      const { dist, t } = distancePointToRay(origin, dir, pos, closest);
      if (t < 0 || dist > pickRadius) continue;
      if (!best || dist < best.dist) {
        best = { slot: chain.slot, dist };
      }
    }

    return best?.slot ?? null;
  }

  getEndEffector(slot: LimbSlot): Tuple3 {
    const chain = this.chains.find(c => c.slot === slot)!;
    const p = chain.joints[2];
    return [p.x, p.y, p.z];
  }

  setLimbTarget(slot: LimbSlot, x: number, y: number, z: number): void {
    let target = this.limbTargets.get(slot);
    if (!target) {
      target = new Vec3();
      this.limbTargets.set(slot, target);
    }
    target.set(x, y, z);
    this.syncVisuals();
  }

  restoreLimbFromGrip(slot: LimbSlot, collision: VoxelCollision, grips: Grip[], gripId: string): void {
    const grip = grips.find(g => g.id === gripId);
    if (!grip) return;
    const w = gripWorldPosition(collision, grip);
    this.setLimbTarget(slot, w[0], w[1], w[2]);
  }

  private chainOrigin(slot: LimbSlot): Vec3 {
    const isArm = slot === 'LH' || slot === 'RH';
    const offset = slot === 'LH' ? SHOULDER_OFFSET :
      slot === 'RH' ? SHOULDER_OFFSET_R :
        slot === 'LF' ? HIP_OFFSET_L : HIP_OFFSET_R;

    this.chest.copy(this.facing).mulScalar(0.12).add(this.pelvis);
    if (isArm) {
      return new Vec3().copy(this.chest).add(offset);
    }
    return new Vec3().copy(this.pelvis).add(offset);
  }

  private update(): void {
    this.pelvisMarker.setPosition(this.pelvis);

    for (const chain of this.chains) {
      const origin = this.chainOrigin(chain.slot);
      chain.joints[0].copy(origin);

      const target = this.limbTargets.get(chain.slot) ??
        new Vec3().copy(origin).add(new Vec3(0, -0.4, 0.15));

      solveFabrik(chain.joints, chain.boneLengths, target);

      for (let i = 0; i < chain.spheres.length; i++) {
        chain.spheres[i].setPosition(chain.joints[i]);
      }
      orientBone(chain.bones[0], chain.joints[0], chain.joints[1], 0.018);
      orientBone(chain.bones[1], chain.joints[1], chain.joints[2], 0.015);
    }

    const chestEntity = this.root.findByName('chest');
    if (chestEntity) {
      chestEntity.setPosition(this.chest);
      orientBone(this.spineBone, this.pelvis, this.chest, 0.022);
    }
  }

  private syncVisuals(): void {
    this.update();
  }
}

export { Puppet };
