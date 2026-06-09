import { Keyboard, KEY_A, KEY_D, KEY_E, KEY_Q, KEY_S, KEY_W, Vec3 } from 'playcanvas';

export class OrbitCamera {
  target = new Vec3(0, 1.5, 0);
  distance = 4;
  yaw = 0;
  pitch = 15;

  /** Meters per second at reference distance; scales with zoom level. */
  moveSpeed = 2.5;

  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private button = 0;

  private readonly _forward = new Vec3();
  private readonly _right = new Vec3();
  private readonly _move = new Vec3();

  onPointerDown(x: number, y: number, button: number): void {
    this.dragging = true;
    this.lastX = x;
    this.lastY = y;
    this.button = button;
  }

  onPointerUp(): void {
    this.dragging = false;
  }

  onPointerMove(x: number, y: number): void {
    if (!this.dragging) return;

    const dx = x - this.lastX;
    const dy = y - this.lastY;
    this.lastX = x;
    this.lastY = y;

    if (this.button === 0) {
      this.yaw -= dx * 0.3;
      this.pitch -= dy * 0.3;
      this.pitch = Math.max(-85, Math.min(85, this.pitch));
    } else if (this.button === 1 || this.button === 2) {
      const right = new Vec3(Math.cos(this.yaw * Math.PI / 180), 0, Math.sin(this.yaw * Math.PI / 180));
      const up = new Vec3(0, 1, 0);
      const panScale = this.distance * 0.001;
      this.target.add(right.mulScalar(-dx * panScale));
      this.target.add(up.mulScalar(dy * panScale));
    }
  }

  onWheel(deltaY: number): void {
    this.distance *= 1 + deltaY * 0.001;
    this.distance = Math.max(0.5, Math.min(50, this.distance));
  }

  /** WASD = pan on XZ plane; Q/E = down/up. */
  updateKeyboard(keyboard: Keyboard, dt: number): void {
    const speed = this.moveSpeed * (this.distance / 4) * dt;
    const yawRad = this.yaw * Math.PI / 180;

    this._forward.set(Math.sin(yawRad), 0, Math.cos(yawRad));
    this._right.set(Math.cos(yawRad), 0, -Math.sin(yawRad));
    this._move.set(0, 0, 0);

    if (keyboard.isPressed(KEY_W)) this._move.sub(this._forward);
    if (keyboard.isPressed(KEY_S)) this._move.add(this._forward);
    if (keyboard.isPressed(KEY_A)) this._move.sub(this._right);
    if (keyboard.isPressed(KEY_D)) this._move.add(this._right);

    if (this._move.lengthSq() > 0) {
      this._move.normalize().mulScalar(speed);
      this.target.add(this._move);
    }

    if (keyboard.isPressed(KEY_E)) this.target.y += speed;
    if (keyboard.isPressed(KEY_Q)) this.target.y -= speed;
  }

  applyToCamera(position: Vec3, rotation: Vec3): void {
    const yawRad = this.yaw * Math.PI / 180;
    const pitchRad = this.pitch * Math.PI / 180;

    position.set(
      this.target.x + this.distance * Math.cos(pitchRad) * Math.sin(yawRad),
      this.target.y + this.distance * Math.sin(pitchRad),
      this.target.z + this.distance * Math.cos(pitchRad) * Math.cos(yawRad)
    );

    rotation.set(-this.pitch, this.yaw, 0);
  }

  focusOn(center: Vec3, radius: number): void {
    this.target.copy(center);
    this.distance = Math.max(radius, 2);
  }
}
