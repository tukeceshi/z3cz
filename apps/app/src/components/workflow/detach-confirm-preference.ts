const STORAGE_KEY = "workflow.skipDetachWithRecordsConfirm";

export function readSkipDetachWithRecordsConfirm(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSkipDetachWithRecordsConfirm(skip: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, skip ? "1" : "0");
  } catch {
    // ignore quota / private mode
  }
}
