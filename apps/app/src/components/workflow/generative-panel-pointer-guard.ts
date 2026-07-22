/** Keeps sole-selected node while pointer interaction starts in a generative bottom panel. */
let activeNodeId: string | null = null;
let listenersAttached = false;

function releasePointerGuard(): void {
  window.removeEventListener("pointerup", releasePointerGuard, true);
  window.removeEventListener("pointercancel", releasePointerGuard, true);
  listenersAttached = false;
  window.setTimeout(() => {
    activeNodeId = null;
  }, 0);
}

export function armGenerativePanelPointerGuard(nodeId: string): void {
  activeNodeId = nodeId;
  if (listenersAttached) {
    return;
  }
  listenersAttached = true;
  window.addEventListener("pointerup", releasePointerGuard, true);
  window.addEventListener("pointercancel", releasePointerGuard, true);
}

export function shouldSuppressGenerativePanelDeselect(nodeId: string): boolean {
  return activeNodeId === nodeId;
}
