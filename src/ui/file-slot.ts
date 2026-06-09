export class FileSlot {
  readonly input: HTMLInputElement;
  private idleEl: HTMLElement;
  private loadedEl: HTMLElement;
  private nameEl: HTMLElement;
  private replaceBtn: HTMLButtonElement;

  constructor(root: HTMLElement) {
    this.input = root.querySelector('input[type="file"]')!;
    this.idleEl = root.querySelector('.file-slot-idle')!;
    this.loadedEl = root.querySelector('.file-slot-loaded')!;
    this.nameEl = root.querySelector('.file-slot-name')!;
    this.replaceBtn = root.querySelector('.file-slot-replace')!;

    this.idleEl.addEventListener('click', () => this.input.click());
    this.replaceBtn.addEventListener('click', () => {
      this.input.value = '';
      this.input.click();
    });
  }

  setLoaded(name: string | null): void {
    const loaded = !!name;
    this.idleEl.hidden = loaded;
    this.loadedEl.hidden = !loaded;
    if (name) {
      this.nameEl.textContent = name;
      this.nameEl.title = name;
    }
  }

  clear(): void {
    this.input.value = '';
    this.setLoaded(null);
  }
}
