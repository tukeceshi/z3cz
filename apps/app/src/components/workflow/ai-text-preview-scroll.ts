export const SCROLL_BOTTOM_THRESHOLD_PX = 48;

export function isNearScrollBottom(
  element: HTMLElement,
  thresholdPx = SCROLL_BOTTOM_THRESHOLD_PX
): boolean {
  return (
    element.scrollTop + element.clientHeight >=
    element.scrollHeight - thresholdPx
  );
}

export function scrollContainerToBottom(element: HTMLElement): void {
  element.scrollTop = element.scrollHeight;
}

export function scrollContainerToTop(element: HTMLElement): void {
  element.scrollTop = 0;
}

export function resetScrollContainer(
  element: HTMLElement | null | undefined
): void {
  if (!element) return;
  element.scrollTop = 0;
}
