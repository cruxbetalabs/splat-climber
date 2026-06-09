import { ClimberScene } from './climber-scene';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;

const scene = new ClimberScene(canvas);
scene.init().catch((err) => {
  console.error(err);
  document.getElementById('scene-status')!.textContent = `Failed to start: ${(err as Error).message}`;
});
