const STORAGE_KEY = "dafthunk-canvas-theme-tip-dismissed";

export function isCanvasThemeTipDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

export function dismissCanvasThemeTip(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // ignore quota / private mode
  }
}
