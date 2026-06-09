import {
  AppBase,
  AppOptions,
  Asset,
  CameraComponentSystem,
  GSplatComponentSystem,
  GSplatHandler,
  LightComponentSystem,
  RenderComponentSystem,
  StandardMaterial,
  type GraphicsDevice,
  type Keyboard,
  type Mouse,
  type TouchDevice
} from 'playcanvas';

interface AppConstructorOptions {
  graphicsDevice: GraphicsDevice;
  mouse: Mouse;
  touch: TouchDevice;
  keyboard: Keyboard;
}

class ClimberApp extends AppBase {
  constructor(canvas: HTMLCanvasElement, options: AppConstructorOptions) {
    super(canvas);

    const appOptions = new AppOptions();
    appOptions.graphicsDevice = options.graphicsDevice;
    appOptions.componentSystems = [
      CameraComponentSystem,
      LightComponentSystem,
      RenderComponentSystem,
      GSplatComponentSystem
    ];
    appOptions.resourceHandlers = [GSplatHandler];
    appOptions.mouse = options.mouse;
    appOptions.touch = options.touch;
    appOptions.keyboard = options.keyboard;

    this.init(appOptions);
  }
}

const loadSplatFile = (app: AppBase, file: File): Promise<Asset> => {
  return new Promise((resolve, reject) => {
    file.arrayBuffer().then((buffer) => {
      const filename = file.name;
      // GSplat PLY parser reads via fetch Response.body — raw ArrayBuffer fails silently.
      const objectUrl = URL.createObjectURL(new Blob([buffer]));
      const asset = new Asset(filename, 'gsplat', {
        url: objectUrl,
        filename
      });

      const cleanup = () => URL.revokeObjectURL(objectUrl);

      asset.on('load', () => {
        cleanup();
        resolve(asset);
      });
      asset.on('error', (err: string) => {
        cleanup();
        reject(new Error(typeof err === 'string' ? err : 'Failed to load splat'));
      });

      app.assets.add(asset);
      app.assets.load(asset);
    }).catch(reject);
  });
};

const createJointMaterial = (color: [number, number, number], overlay = false): StandardMaterial => {
  const mat = new StandardMaterial();
  mat.diffuse.set(color[0], color[1], color[2]);
  mat.emissive.set(color[0], color[1], color[2]);
  mat.useMetalness = false;
  mat.useLighting = !overlay;
  if (overlay) {
    mat.depthTest = false;
    mat.depthWrite = false;
  }
  mat.update();
  return mat;
};

export { ClimberApp, loadSplatFile, createJointMaterial };
