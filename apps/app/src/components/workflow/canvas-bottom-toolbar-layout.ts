import {
  useLayoutEffect,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";

export const CANVAS_BOTTOM_TOOLBAR_AGENT_GAP_PX = 100;
export const CANVAS_BOTTOM_PANEL_MARGIN_BOTTOM_PX = 24;

interface ComputeCanvasBottomToolbarShiftParams {
  readonly containerWidth: number;
  readonly toolbarWidth: number;
  readonly agentRightInContainer: number | null;
  readonly rightInsetPx?: number;
}

/** Extra rightward shift from viewport center (0 = centered). */
export function computeCanvasBottomToolbarShiftPx(
  params: ComputeCanvasBottomToolbarShiftParams
): number {
  const {
    containerWidth,
    toolbarWidth,
    agentRightInContainer,
    rightInsetPx = 16,
  } = params;

  if (toolbarWidth <= 0 || containerWidth <= 0) {
    return 0;
  }

  const centeredLeft = (containerWidth - toolbarWidth) / 2;

  let shiftPx = 0;
  if (agentRightInContainer !== null) {
    const minToolbarLeft =
      agentRightInContainer + CANVAS_BOTTOM_TOOLBAR_AGENT_GAP_PX;
    shiftPx = Math.max(0, minToolbarLeft - centeredLeft);
  }

  const maxToolbarLeft = containerWidth - toolbarWidth - rightInsetPx;
  const maxShiftPx = Math.max(0, maxToolbarLeft - centeredLeft);
  return Math.min(shiftPx, maxShiftPx);
}

function resolveReactFlowContainer(
  shell: HTMLElement | null
): HTMLElement | null {
  if (!shell) {
    return null;
  }
  return shell.querySelector<HTMLElement>(".react-flow");
}

interface UseCanvasBottomToolbarLayoutParams {
  readonly enabled: boolean;
  readonly shellRef: RefObject<HTMLElement | null>;
  readonly agentRef: RefObject<HTMLElement | null>;
  readonly toolbarPanelRef: RefObject<HTMLElement | null>;
}

export function useCanvasBottomToolbarLayout({
  enabled,
  shellRef,
  agentRef,
  toolbarPanelRef,
}: UseCanvasBottomToolbarLayoutParams): CSSProperties {
  const [shiftPx, setShiftPx] = useState(0);

  useLayoutEffect(() => {
    if (!enabled) {
      return;
    }

    const measure = () => {
      const container = resolveReactFlowContainer(shellRef.current);
      const agent = agentRef.current;
      const toolbarPanel = toolbarPanelRef.current;
      if (!container || !toolbarPanel) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const agentRect = agent?.getBoundingClientRect() ?? null;
      const nextShiftPx = computeCanvasBottomToolbarShiftPx({
        containerWidth: containerRect.width,
        toolbarWidth: toolbarPanel.offsetWidth,
        agentRightInContainer: agentRect
          ? agentRect.right - containerRect.left
          : null,
      });
      setShiftPx(nextShiftPx);
    };

    measure();

    const observed = new Set<Element>();
    const observer = new ResizeObserver(measure);

    const observe = (element: Element | null | undefined) => {
      if (!element || observed.has(element)) {
        return;
      }
      observed.add(element);
      observer.observe(element);
    };

    observe(resolveReactFlowContainer(shellRef.current));
    observe(agentRef.current);
    observe(toolbarPanelRef.current);

    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [enabled, shellRef, agentRef, toolbarPanelRef]);

  return {
    marginBottom: CANVAS_BOTTOM_PANEL_MARGIN_BOTTOM_PX,
    transform: `translateX(calc(-50% - 15px + ${shiftPx}px))`,
  };
}
