export interface StudioTextScrollRestore {
  readonly fallbackScrollTop: number;
  readonly anchorKey: string | null;
  readonly viewportOffset: number;
}

export function captureStudioTextScrollRestore(
  container: HTMLElement
): StudioTextScrollRestore {
  const containerTop = container.getBoundingClientRect().top;
  const fallbackScrollTop = container.scrollTop;
  const anchors = [...container.querySelectorAll("[data-studio-scroll-anchor]")];

  const visibleAnchor = anchors.find((element) => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.bottom > containerTop + 1 && rect.top < containerTop + container.clientHeight;
  });

  if (visibleAnchor instanceof HTMLElement) {
    return {
      fallbackScrollTop,
      anchorKey: visibleAnchor.getAttribute("data-studio-scroll-anchor"),
      viewportOffset: visibleAnchor.getBoundingClientRect().top - containerTop,
    };
  }

  return {
    fallbackScrollTop,
    anchorKey: null,
    viewportOffset: 0,
  };
}

export function applyStudioTextScrollRestore(
  container: HTMLElement,
  restore: StudioTextScrollRestore
): void {
  if (restore.anchorKey) {
    const anchor = container.querySelector(
      `[data-studio-scroll-anchor="${restore.anchorKey}"]`
    );
    if (anchor instanceof HTMLElement) {
      const containerTop = container.getBoundingClientRect().top;
      const delta =
        anchor.getBoundingClientRect().top -
        containerTop -
        restore.viewportOffset;
      container.scrollTop += delta;
      return;
    }
  }

  container.scrollTop = restore.fallbackScrollTop;
}
