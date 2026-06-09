import {
  Color,
  Entity,
  FILLMODE_NONE,
  Keyboard,
  Layer,
  Mouse,
  RESOLUTION_AUTO,
  TouchDevice,
  Vec3,
  createGraphicsDevice
} from 'playcanvas';

import {
  collisionSnapshot,
  defaultStart,
  exportAnnotations,
  gripWorldPosition,
  nextGripId,
  parseAnnotations,
  validateCollisionSnapshot
} from './annotations/io';
import type { EditorMode, Grip, LimbSlot, StartPose } from './annotations/types';
import { ClimberApp, createJointMaterial, loadSplatFile } from './app';
import { OrbitCamera } from './camera/orbit';
import { raycastHorizontalPlane } from './camera/raycast';
import { loadVoxelFromFiles, type VoxelCollision } from './collision';
import { GripGizmos } from './grips/grip-gizmos';
import { frameSceneBounds, pickVoxelSurface } from './grips/picker';
import { Puppet } from './puppet/puppet';
import { bindEntityToLayer, setupOverlayLayer } from './scene/layers';
import { FileSlot } from './ui/file-slot';

const LIMB_SLOTS: LimbSlot[] = ['LH', 'RH', 'LF', 'RF'];

export class ClimberScene {
  private canvas: HTMLCanvasElement;
  private app!: ClimberApp;
  private cameraEntity!: Entity;
  private orbit = new OrbitCamera();
  private splatEntity: Entity | null = null;
  private collision: VoxelCollision | null = null;
  private grips: Grip[] = [];
  private start: StartPose = defaultStart();
  private selectedGripId: string | null = null;
  private mode: EditorMode = 'navigate';
  private puppet!: Puppet;
  private gripGizmos!: GripGizmos;
  private voxelJsonFile: File | null = null;
  private voxelBinFile: File | null = null;
  private rendererLabel = 'unknown';

  private splatSlot: FileSlot;
  private voxelJsonSlot: FileSlot;
  private voxelBinSlot: FileSlot;
  private annotationsSlot: FileSlot;

  private keyboard!: Keyboard;

  private overlayLayer!: Layer;
  private splatLayer!: Layer;

  private draggingLimb: LimbSlot | null = null;
  private dragPlaneY = 0;
  private lastDragY = 0;
  private dragGripBefore: string | undefined;
  private readonly dragHit = new Vec3();

  private statusEl: HTMLElement;
  private gripListEl: HTMLElement;
  private rendererEl: HTMLElement;
  private limbSelects: Record<LimbSlot, HTMLSelectElement>;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.statusEl = document.getElementById('scene-status')!;
    this.gripListEl = document.getElementById('grip-list')!;
    this.rendererEl = document.getElementById('renderer-label')!;
    this.limbSelects = {
      LH: document.getElementById('limb-lh') as HTMLSelectElement,
      RH: document.getElementById('limb-rh') as HTMLSelectElement,
      LF: document.getElementById('limb-lf') as HTMLSelectElement,
      RF: document.getElementById('limb-rf') as HTMLSelectElement
    };
    this.splatSlot = new FileSlot(document.getElementById('slot-splat')!);
    this.voxelJsonSlot = new FileSlot(document.getElementById('slot-voxel-json')!);
    this.voxelBinSlot = new FileSlot(document.getElementById('slot-voxel-bin')!);
    this.annotationsSlot = new FileSlot(document.getElementById('slot-annotations')!);
  }

  async init(): Promise<void> {
    const device = await createGraphicsDevice(this.canvas, {
      deviceTypes: ['webgpu'],
      antialias: false,
      depth: true,
      stencil: false,
      powerPreference: 'high-performance'
    });

    this.rendererLabel = device.deviceType;
    this.rendererEl.textContent = `Renderer: ${device.deviceType}`;

    this.app = new ClimberApp(this.canvas, {
      graphicsDevice: device,
      mouse: new Mouse(this.canvas),
      touch: new TouchDevice(this.canvas),
      keyboard: new Keyboard(window)
    });
    this.keyboard = this.app.keyboard!;

    this.canvas.tabIndex = 0;

    this.app.setCanvasFillMode(FILLMODE_NONE);
    this.app.setCanvasResolution(RESOLUTION_AUTO);
    // @ts-expect-error — keep canvas inside #viewport, not full window
    this.app._allowResize = false;
    this.app.scene.ambientLight.set(0.45, 0.48, 0.55);

    this.cameraEntity = new Entity('camera');
    this.cameraEntity.addComponent('camera', {
      clearColor: new Color(0.06, 0.06, 0.08),
      farClip: 500,
      nearClip: 0.01,
      fov: 65
    });
    this.app.root.addChild(this.cameraEntity);

    this.splatLayer = new Layer({ name: 'Splat' });
    this.app.scene.layers.push(this.splatLayer);
    this.overlayLayer = setupOverlayLayer(this.app, this.cameraEntity.camera!);

    const cam = this.cameraEntity.camera!;
    if (!cam.layers.includes(this.splatLayer.id)) {
      cam.layers = [...cam.layers, this.splatLayer.id];
    }

    const light = new Entity('light');
    light.setEulerAngles(45, 30, 0);
    light.addComponent('light', {
      color: new Color(1, 0.98, 0.95),
      intensity: 1.2
    });
    this.app.root.addChild(light);

    const jointMat = createJointMaterial([1, 0.55, 0.15], true);
    const endMat = createJointMaterial([1, 0.85, 0.2], true);
    const boneMat = createJointMaterial([0.95, 0.45, 0.1], true);
    const gripMat = createJointMaterial([0.35, 0.75, 1], true);

    this.puppet = new Puppet(this.app, this.app.root, jointMat, endMat, boneMat);
    this.gripGizmos = new GripGizmos(this.app, this.app.root, gripMat, this.overlayLayer.id);
    bindEntityToLayer(this.puppet.root, this.overlayLayer.id);

    this.bindInput();
    this.bindPanel();
    this.app.on('update', (dt: number) => this.onUpdate(dt));
    this.app.start();

    const resizeCanvas = () => {
      const w = this.canvas.clientWidth;
      const h = this.canvas.clientHeight;
      if (w > 0 && h > 0) {
        this.app.resizeCanvas(w, h);
      }
    };

    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(this.canvas);
    resizeCanvas();

    this.setStatus('Load a splat and voxel collision pair to begin.');
  }

  private onUpdate(dt: number): void {
    if (this.keyboardInputEnabled()) {
      this.orbit.updateKeyboard(this.keyboard, dt);
    }

    const pos = new Vec3();
    const rot = new Vec3();
    this.orbit.applyToCamera(pos, rot);
    this.cameraEntity.setPosition(pos);
    this.cameraEntity.setEulerAngles(rot.x, rot.y, rot.z);
  }

  private keyboardInputEnabled(): boolean {
    const el = document.activeElement;
    if (!el || el === this.canvas || el === document.body) return true;
    const tag = el.tagName;
    return tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT';
  }

  private bindInput(): void {
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.mode === 'add-grip' && e.button === 0 && this.collision) {
        this.addGripAt(e.offsetX, e.offsetY);
        return;
      }

      if (this.mode === 'pose-puppet' && e.button === 0) {
        this.canvas.focus();
        const slot = this.puppet.pickEndEffector(this.cameraEntity.camera!, e.offsetX, e.offsetY);
        if (!slot) {
          this.setStatus('Click a hand or foot joint to drag it.');
          return;
        }
        const ee = this.puppet.getEndEffector(slot);
        this.draggingLimb = slot;
        this.dragPlaneY = ee[1];
        this.lastDragY = e.offsetY;
        this.dragGripBefore = this.start.limbs[slot];
        this.canvas.classList.add('dragging');
        this.canvas.setPointerCapture(e.pointerId);
        this.dragLimbTo(e.offsetX, e.offsetY, e.shiftKey);
        return;
      }

      this.canvas.focus();
      this.orbit.onPointerDown(e.offsetX, e.offsetY, e.button);
      this.canvas.setPointerCapture(e.pointerId);
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (this.draggingLimb) {
        this.dragLimbTo(e.offsetX, e.offsetY, e.shiftKey);
        return;
      }
      this.orbit.onPointerMove(e.offsetX, e.offsetY);
    });

    this.canvas.addEventListener('pointerup', (e) => {
      if (this.draggingLimb) {
        const slot = this.draggingLimb;
        this.draggingLimb = null;
        this.canvas.classList.remove('dragging');
        this.finishLimbDrag(slot);
      } else {
        this.orbit.onPointerUp();
      }
      this.canvas.releasePointerCapture(e.pointerId);
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.orbit.onWheel(e.deltaY);
    }, { passive: false });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private bindPanel(): void {
    document.getElementById('splat-input')!.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) void this.loadSplat(file);
    });

    document.getElementById('voxel-json-input')!.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0] ?? null;
      this.voxelJsonFile = file;
      this.voxelJsonSlot.setLoaded(file?.name ?? null);
      void this.tryLoadVoxel();
    });

    document.getElementById('voxel-bin-input')!.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0] ?? null;
      this.voxelBinFile = file;
      this.voxelBinSlot.setLoaded(file?.name ?? null);
      void this.tryLoadVoxel();
    });

    document.getElementById('annotations-input')!.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) void this.loadAnnotations(file);
    });

    document.getElementById('mode-navigate')!.addEventListener('click', () => this.setMode('navigate'));
    document.getElementById('mode-add-grip')!.addEventListener('click', () => this.setMode('add-grip'));
    document.getElementById('mode-move-puppet')!.addEventListener('click', () => this.setMode('pose-puppet'));

    document.getElementById('delete-grip')!.addEventListener('click', () => this.deleteSelectedGrip());

    for (const slot of LIMB_SLOTS) {
      this.limbSelects[slot].addEventListener('change', () => this.onLimbChanged(slot));
    }

    document.getElementById('set-start')!.addEventListener('click', () => this.setStartFromPuppet());
    document.getElementById('reset-start')!.addEventListener('click', () => this.resetToStart());
    document.getElementById('export-annotations')!.addEventListener('click', () => this.exportJson());
  }

  private setMode(mode: EditorMode): void {
    this.mode = mode;
    this.canvas.classList.toggle('add-grip', mode === 'add-grip');
    this.canvas.classList.toggle('pose-puppet', mode === 'pose-puppet');
    document.getElementById('mode-navigate')!.classList.toggle('active', mode === 'navigate');
    document.getElementById('mode-add-grip')!.classList.toggle('active', mode === 'add-grip');
    document.getElementById('mode-move-puppet')!.classList.toggle('active', mode === 'pose-puppet');

    if (mode === 'pose-puppet') {
      this.setStatus('Pose limbs: drag a hand or foot onto the wall. Release near a grip to assign.');
    }
  }

  private dragLimbTo(sx: number, sy: number, shift: boolean): void {
    if (!this.draggingLimb) return;

    const cam = this.cameraEntity.camera!;
    const slot = this.draggingLimb;
    const ee = this.puppet.getEndEffector(slot);

    if (shift) {
      const dy = (sy - this.lastDragY) * -0.004 * this.orbit.distance;
      this.lastDragY = sy;
      this.puppet.setLimbTarget(slot, ee[0], ee[1] + dy, ee[2]);
      this.dragPlaneY = this.puppet.getEndEffector(slot)[1];
      return;
    }

    this.lastDragY = sy;

    if (this.collision) {
      const pick = pickVoxelSurface(
        cam,
        this.collision,
        sx,
        sy,
        this.canvas.clientWidth,
        this.canvas.clientHeight
      );
      if (pick) {
        this.puppet.setLimbTarget(slot, pick.point.x, pick.point.y, pick.point.z);
        return;
      }
    }

    if (!raycastHorizontalPlane(cam, sx, sy, this.dragPlaneY, this.dragHit)) {
      return;
    }

    this.puppet.setLimbTarget(slot, this.dragHit.x, this.dragPlaneY, this.dragHit.z);
  }

  private finishLimbDrag(slot: LimbSlot): void {
    if (!this.collision) return;

    const ee = this.puppet.getEndEffector(slot);
    const snapDist = this.collision.voxelResolution * 2;
    let nearest: { id: string; dist: number } | null = null;

    for (const grip of this.grips) {
      const w = gripWorldPosition(this.collision, grip);
      const dist = Math.hypot(w[0] - ee[0], w[1] - ee[1], w[2] - ee[2]);
      if (dist <= snapDist && (!nearest || dist < nearest.dist)) {
        nearest = { id: grip.id, dist };
      }
    }

    if (nearest) {
      this.start.limbs[slot] = nearest.id;
      this.puppet.restoreLimbFromGrip(slot, this.collision, this.grips, nearest.id);
      this.refreshLimbSelects();
      this.setStatus(`${slot} snapped to ${nearest.id}. Set start from puppet to save.`);
      return;
    }

    if (this.dragGripBefore) {
      this.puppet.restoreLimbFromGrip(slot, this.collision, this.grips, this.dragGripBefore);
      this.setStatus(`${slot} released — snap within ${snapDist.toFixed(2)} m of a grip to assign.`);
    } else {
      this.setStatus(`${slot} moved freely. Drop near a grip to assign, or use Start pose dropdowns.`);
    }
  }

  private async loadSplat(file: File): Promise<void> {
    try {
      if (this.splatEntity) {
        this.splatEntity.destroy();
        this.splatEntity = null;
      }

      const sizeMb = (file.size / (1024 * 1024)).toFixed(0);
      this.setStatus(`Loading ${file.name} (${sizeMb} MB)…`);

      const asset = await loadSplatFile(this.app, file);
      const entity = new Entity('splat');
      entity.setLocalEulerAngles(0, 0, 180);
      entity.addComponent('gsplat', { unified: true, asset, layers: [this.splatLayer.id] });
      this.app.root.addChild(entity);
      this.splatEntity = entity;
      this.splatSlot.setLoaded(file.name);

      this.setStatus(`Splat loaded: ${file.name}`);
    } catch (err) {
      console.error(err);
      this.splatSlot.clear();
      this.setStatus(`Splat error: ${(err as Error).message}`);
    }
  }

  private async tryLoadVoxel(): Promise<void> {
    if (!this.voxelJsonFile || !this.voxelBinFile) return;

    try {
      this.collision = await loadVoxelFromFiles(this.voxelJsonFile, this.voxelBinFile);
      const { center, radius } = frameSceneBounds(this.collision);
      this.orbit.focusOn(center, radius);

      const pelvis = this.puppet.getPelvis();
      if (pelvis[0] === 0 && pelvis[1] === 1 && pelvis[2] === 0) {
        this.start.pelvis = [center.x, center.y - radius * 0.3, center.z + radius * 0.4];
        this.puppet.applyStart(this.start, this.collision, this.grips);
      }

      this.refreshGrips();
      this.setStatus(`Collision loaded (${this.collision.voxelResolution} m voxels). Switch to Add grip → click wall.`);
    } catch (err) {
      this.collision = null;
      this.setStatus(`Voxel error: ${(err as Error).message}`);
    }
  }

  private addGripAt(x: number, y: number): void {
    if (!this.collision) return;

    const cam = this.cameraEntity.camera!;
    const pick = pickVoxelSurface(
      cam,
      this.collision,
      x,
      y,
      this.canvas.clientWidth,
      this.canvas.clientHeight
    );

    if (!pick) {
      this.setStatus('No surface hit — click the wall collision.');
      return;
    }

    const labelInput = document.getElementById('grip-label') as HTMLInputElement;
    const grip: Grip = {
      id: nextGripId(this.grips),
      voxel: pick.voxel,
      normal: pick.normal,
      label: labelInput.value.trim() || undefined
    };

    this.grips.push(grip);
    this.selectedGripId = grip.id;
    labelInput.value = '';
    this.refreshGrips();
    this.setStatus(`Added grip ${grip.id} at voxel [${pick.voxel.join(', ')}]`);
  }

  private deleteSelectedGrip(): void {
    if (!this.selectedGripId) return;
    this.grips = this.grips.filter(g => g.id !== this.selectedGripId);

    for (const slot of LIMB_SLOTS) {
      if (this.start.limbs[slot] === this.selectedGripId) {
        delete this.start.limbs[slot];
      }
    }

    this.selectedGripId = null;
    this.refreshGrips();
  }

  private refreshGrips(): void {
    this.gripGizmos.select(this.selectedGripId);
    this.gripGizmos.sync(this.grips, this.collision, this.app);
    this.renderGripList();
    this.refreshLimbSelects();
    document.getElementById('delete-grip')!.toggleAttribute('disabled', !this.selectedGripId);

    if (this.collision) {
      this.puppet.applyStart(this.start, this.collision, this.grips);
    }
  }

  private renderGripList(): void {
    this.gripListEl.innerHTML = '';
    for (const grip of this.grips) {
      const li = document.createElement('li');
      li.textContent = grip.label ? `${grip.id} — ${grip.label}` : grip.id;
      li.classList.toggle('selected', grip.id === this.selectedGripId);
      li.addEventListener('click', () => {
        this.selectedGripId = grip.id;
        this.refreshGrips();
      });
      this.gripListEl.appendChild(li);
    }
  }

  private refreshLimbSelects(): void {
    for (const slot of LIMB_SLOTS) {
      const sel = this.limbSelects[slot];
      const current = this.start.limbs[slot] ?? '';
      sel.innerHTML = '<option value="">—</option>';
      for (const grip of this.grips) {
        const opt = document.createElement('option');
        opt.value = grip.id;
        opt.textContent = grip.label ? `${grip.id} (${grip.label})` : grip.id;
        opt.selected = grip.id === current;
        sel.appendChild(opt);
      }
    }
  }

  private onLimbChanged(slot: LimbSlot): void {
    const gripId = this.limbSelects[slot].value;
    if (gripId) {
      this.start.limbs[slot] = gripId;
    } else {
      delete this.start.limbs[slot];
    }
    if (this.collision) {
      this.puppet.applyStart(this.start, this.collision, this.grips);
    }
  }

  private setStartFromPuppet(): void {
    this.start.pelvis = this.puppet.getPelvis();
    this.setStatus('Start pelvis updated from puppet position.');
  }

  private resetToStart(): void {
    if (this.collision) {
      this.puppet.fitPelvisFromGrips(this.collision, this.grips, this.start.limbs);
      this.start.pelvis = this.puppet.getPelvis();
      this.puppet.applyStart(this.start, this.collision, this.grips);
      this.setStatus('Puppet posed at assigned grips. Adjust with Set start if needed.');
    }
  }

  private async loadAnnotations(file: File): Promise<void> {
    try {
      const data = parseAnnotations(JSON.parse(await file.text()));

      if (data.collision && this.collision) {
        const warn = validateCollisionSnapshot(data.collision, collisionSnapshot(this.collision));
        if (warn) this.setStatus(`Warning: ${warn}`);
      }

      this.grips = data.grips;
      this.start = data.start;
      this.selectedGripId = this.grips[0]?.id ?? null;
      this.annotationsSlot.setLoaded(file.name);
      this.refreshGrips();
      this.setStatus(`Imported ${this.grips.length} grips from ${file.name}`);
    } catch (err) {
      this.annotationsSlot.clear();
      this.setStatus(`Import error: ${(err as Error).message}`);
    }
  }

  private exportJson(): void {
    const payload = exportAnnotations(this.grips, this.start, this.collision);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'scene.climb.json';
    a.click();
    URL.revokeObjectURL(a.href);
    this.setStatus('Exported scene.climb.json');
  }

  private setStatus(msg: string): void {
    this.statusEl.textContent = msg;
  }
}
