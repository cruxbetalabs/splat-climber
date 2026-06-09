import { Entity, Layer, type AppBase, type CameraComponent } from 'playcanvas';

/** Layer drawn after the splat so puppet/grips stay visible up close. */
const setupOverlayLayer = (app: AppBase, camera: CameraComponent): Layer => {
  const overlay = new Layer({ name: 'ClimberOverlay' });
  app.scene.layers.push(overlay);

  if (!camera.layers.includes(overlay.id)) {
    camera.layers = [...camera.layers, overlay.id];
  }

  return overlay;
};

const bindEntityToLayer = (entity: Entity, layerId: number): void => {
  if (entity.render) {
    entity.render.layers = [layerId];
  }
  for (const child of entity.children) {
    bindEntityToLayer(child as Entity, layerId);
  }
};

export { bindEntityToLayer, setupOverlayLayer };
