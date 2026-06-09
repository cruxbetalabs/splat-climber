import {
  createSphere,
  Entity,
  MeshInstance,
  type AppBase,
  type StandardMaterial
} from 'playcanvas';

import type { Grip } from '../annotations/types';
import type { VoxelCollision } from '../collision';
import { gripWorldPosition } from '../annotations/io';
import { bindEntityToLayer } from '../scene/layers';

const createMarker = (
  app: AppBase,
  material: StandardMaterial,
  scale: number
): Entity => {
  const entity = new Entity('marker');
  const mesh = createSphere(app.graphicsDevice, { radius: 1 });
  entity.addComponent('render', {
    meshInstances: [new MeshInstance(mesh, material)]
  });
  entity.setLocalScale(scale, scale, scale);
  return entity;
};

class GripGizmos {
  readonly root: Entity;

  private overlayLayerId: number;
  private markers = new Map<string, Entity>();
  private selectedId: string | null = null;
  private gripMaterial: StandardMaterial;
  private selectedMaterial: StandardMaterial;

  constructor(app: AppBase, parent: Entity, baseMat: StandardMaterial, overlayLayerId: number) {
    this.root = new Entity('grip-gizmos');
    parent.addChild(this.root);
    this.overlayLayerId = overlayLayerId;

    this.gripMaterial = baseMat;
    this.selectedMaterial = baseMat.clone() as StandardMaterial;
    this.selectedMaterial.diffuse.set(1, 0.6, 0.2);
    this.selectedMaterial.emissive.set(0.4, 0.2, 0);
    this.selectedMaterial.update();
  }

  sync(grips: Grip[], collision: VoxelCollision | null, app: AppBase): void {
    const ids = new Set(grips.map(g => g.id));

    for (const [id, entity] of this.markers) {
      if (!ids.has(id)) {
        entity.destroy();
        this.markers.delete(id);
      }
    }

    if (!collision) return;

    for (const grip of grips) {
      const pos = gripWorldPosition(collision, grip);
      let entity = this.markers.get(grip.id);
      if (!entity) {
        entity = createMarker(app, this.gripMaterial, 0.08);
        entity.name = grip.id;
        bindEntityToLayer(entity, this.overlayLayerId);
        this.root.addChild(entity);
        this.markers.set(grip.id, entity);
      }

      entity.setPosition(pos[0], pos[1], pos[2]);
      const mat = grip.id === this.selectedId ? this.selectedMaterial : this.gripMaterial;
      entity.render!.meshInstances[0].material = mat;
    }
  }

  select(id: string | null): void {
    this.selectedId = id;
  }

  getSelected(): string | null {
    return this.selectedId;
  }
}

export { GripGizmos };
