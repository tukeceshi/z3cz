const STORAGE_KEY = "workflow.skipVideoTrimShortDurationConfirm";

export function readSkipVideoTrimShortDurationConfirm(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSkipVideoTrimShortDurationConfirm(skip: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, skip ? "1" : "0");
  } catch {
    // ignore quota / private mode
  }
}
