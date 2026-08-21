const STORAGE_KEY = "dafthunk-canvas-shortcut-hint-collapsed";

export function readCanvasShortcutHintCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeCanvasShortcutHintCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    // ignore quota / private mode
  }
}
