let canvasMaintenanceFrozen = false;

export function getCanvasMaintenanceFrozen(): boolean {
  return canvasMaintenanceFrozen;
}

export function setCanvasMaintenanceFrozen(value: boolean): void {
  canvasMaintenanceFrozen = value;
}
