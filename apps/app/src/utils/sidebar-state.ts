export const SIDEBAR_COOKIE_NAME = "sidebar_state_v2";
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
export const SIDEBAR_BEFORE_EDITOR_KEY = "dafthunk:sidebar-before-editor";
export const SIDEBAR_RESTORE_ON_MOUNT_KEY = "dafthunk:sidebar-restore-on-mount";

export function readSidebarCookie(): boolean | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }

  const match = document.cookie.match(
    `(?:^|; )${SIDEBAR_COOKIE_NAME}=([^;]*)`
  );
  if (!match) {
    return undefined;
  }

  return match[1] === "true";
}

export function writeSidebarCookie(open: boolean): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${SIDEBAR_COOKIE_NAME}=${open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
}

export function readSidebarBeforeEditor(): boolean | undefined {
  if (typeof sessionStorage === "undefined") {
    return undefined;
  }

  const value = sessionStorage.getItem(SIDEBAR_BEFORE_EDITOR_KEY);
  if (value === null) {
    return undefined;
  }

  return value === "true";
}

export function writeSidebarBeforeEditor(open: boolean): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }

  sessionStorage.setItem(SIDEBAR_BEFORE_EDITOR_KEY, String(open));
}

export function consumeSidebarRestoreOnMount(): boolean | undefined {
  if (typeof sessionStorage === "undefined") {
    return undefined;
  }

  const value = sessionStorage.getItem(SIDEBAR_RESTORE_ON_MOUNT_KEY);
  if (value === null) {
    return undefined;
  }

  sessionStorage.removeItem(SIDEBAR_RESTORE_ON_MOUNT_KEY);
  return value === "true";
}

export function resolveSidebarInitialOpen(defaultOpen: boolean): boolean {
  const pendingRestore = consumeSidebarRestoreOnMount();
  if (pendingRestore !== undefined) {
    return pendingRestore;
  }

  const cookie = readSidebarCookie();
  if (cookie !== undefined) {
    return cookie;
  }

  return defaultOpen;
}
