import type { WorkflowEditorViewport } from "@dafthunk/types";
import type { ReactFlowInstance } from "@xyflow/react";

export function isValidWorkflowEditorViewport(
  value: unknown
): value is WorkflowEditorViewport {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as WorkflowEditorViewport;
  return (
    Number.isFinite(candidate.x) &&
    Number.isFinite(candidate.y) &&
    Number.isFinite(candidate.zoom) &&
    candidate.zoom > 0
  );
}

export function normalizeWorkflowEditorViewport(
  viewport: WorkflowEditorViewport
): WorkflowEditorViewport {
  return {
    x: viewport.x,
    y: viewport.y,
    zoom: viewport.zoom,
  };
}

const VIEWPORT_NEARLY_EQUAL_ZOOM_EPS = 0.01;
const VIEWPORT_NEARLY_EQUAL_XY_EPS = 2;

/** Skip redundant setViewport when live canvas already matches the target. */
export function viewportNearlyEqual(
  a: WorkflowEditorViewport,
  b: WorkflowEditorViewport
): boolean {
  return (
    Math.abs(a.x - b.x) < VIEWPORT_NEARLY_EQUAL_XY_EPS &&
    Math.abs(a.y - b.y) < VIEWPORT_NEARLY_EQUAL_XY_EPS &&
    Math.abs(a.zoom - b.zoom) < VIEWPORT_NEARLY_EQUAL_ZOOM_EPS
  );
}

/** Matches React Flow `setCenter` target viewport (x/y before pan animation). */
export function computeViewportForFlowCenter(
  reactFlowInstance: ReactFlowInstance,
  centerX: number,
  centerY: number,
  zoom: number
): WorkflowEditorViewport {
  const pane = document.querySelector<HTMLElement>(".react-flow");
  const width = pane?.getBoundingClientRect().width ?? window.innerWidth;
  const height = pane?.getBoundingClientRect().height ?? window.innerHeight;

  return normalizeWorkflowEditorViewport({
    x: width / 2 - centerX * zoom,
    y: height / 2 - centerY * zoom,
    zoom,
  });
}

const PANE_STABLE_FRAMES = 2;
const PANE_READY_TIMEOUT_MS = 500;

/** Apply saved viewport after the React Flow pane has a stable non-zero size. */
export function restoreEditorViewportWhenPaneStable(
  instance: ReactFlowInstance,
  viewport: WorkflowEditorViewport,
  onRestored: () => void
): () => void {
  let cancelled = false;
  let observer: ResizeObserver | null = null;
  let fallbackTimer: number | null = null;
  let lastWidth = 0;
  let lastHeight = 0;
  let stableFrames = 0;

  const apply = () => {
    if (cancelled) {
      return;
    }
    const live = instance.getViewport();
    if (viewportNearlyEqual(live, viewport)) {
      onRestored();
      return;
    }
    void instance.setViewport(viewport, { duration: 0 });
    onRestored();
  };

  const scheduleApply = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(apply);
    });
  };

  const tryApplyWhenStable = (width: number, height: number) => {
    if (width <= 0 || height <= 0) {
      stableFrames = 0;
      return;
    }

    if (width === lastWidth && height === lastHeight) {
      stableFrames += 1;
      if (stableFrames >= PANE_STABLE_FRAMES) {
        observer?.disconnect();
        observer = null;
        if (fallbackTimer !== null) {
          window.clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
        scheduleApply();
      }
      return;
    }

    lastWidth = width;
    lastHeight = height;
    stableFrames = 0;
  };

  const pane = document.querySelector<HTMLElement>(".react-flow");
  if (!pane) {
    scheduleApply();
    return () => {
      cancelled = true;
    };
  }

  observer = new ResizeObserver(() => {
    const { width, height } = pane.getBoundingClientRect();
    tryApplyWhenStable(width, height);
  });
  observer.observe(pane);

  const { width, height } = pane.getBoundingClientRect();
  tryApplyWhenStable(width, height);

  fallbackTimer = window.setTimeout(() => {
    if (cancelled) {
      return;
    }
    observer?.disconnect();
    observer = null;
    scheduleApply();
  }, PANE_READY_TIMEOUT_MS);

  return () => {
    cancelled = true;
    observer?.disconnect();
    if (fallbackTimer !== null) {
      window.clearTimeout(fallbackTimer);
    }
  };
}
