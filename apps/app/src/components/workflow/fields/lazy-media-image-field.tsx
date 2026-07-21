import type { MediaReference, ObjectReference } from "@dafthunk/types";
import { useEffect, useRef, useState } from "react";

import type { MediaDisplaySize } from "@/services/media-display-size";

import { MediaImageField } from "./media-image-field";

interface LazyMediaImageFieldProps {
  readonly value: MediaReference;
  readonly createObjectUrl?: (ref: ObjectReference) => string;
  readonly className?: string;
  readonly size?: MediaDisplaySize;
  readonly scrollRoot?: HTMLElement | null;
}

function isElementVisible(element: HTMLElement, root: HTMLElement | null): boolean {
  const targetRect = element.getBoundingClientRect();
  if (targetRect.width <= 0 || targetRect.height <= 0) return false;

  if (!root) {
    return targetRect.top < window.innerHeight && targetRect.bottom > 0;
  }

  const rootRect = root.getBoundingClientRect();
  return (
    targetRect.bottom > rootRect.top &&
    targetRect.top < rootRect.bottom &&
    targetRect.right > rootRect.left &&
    targetRect.left < rootRect.right
  );
}

export function LazyMediaImageField({
  value,
  createObjectUrl,
  className,
  size = "thumb",
  scrollRoot = null,
}: LazyMediaImageFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    if (isElementVisible(element, scrollRoot)) {
      setVisible(true);
      return;
    }

    const root = scrollRoot ?? null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { root, rootMargin: "80px" }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [scrollRoot]);

  return (
    <div ref={containerRef} className={className}>
      {visible ? (
        <MediaImageField
          value={value}
          createObjectUrl={createObjectUrl}
          className="h-full w-full"
          size={size}
        />
      ) : (
        <div className="h-full w-full rounded-md bg-muted/60" />
      )}
    </div>
  );
}
