import { useCallback, useEffect, useRef, useState } from "react";

export interface AgentSidebarSnapshot {
  readonly visible: boolean;
  readonly width: number;
}

interface UseResizableSidebarProps {
  initialVisible: boolean;
  initialWidth?: number;
  onPersist?: (state: AgentSidebarSnapshot) => void;
}

interface UseResizableSidebarReturn {
  isSidebarVisible: boolean;
  sidebarWidth: number;
  isResizing: boolean;
  toggleSidebar: () => void;
  setIsSidebarVisible: (visible: boolean) => void;
  handleResizeStart: (e: React.MouseEvent) => void;
}

export function useResizableSidebar({
  initialVisible,
  initialWidth = 384,
  onPersist,
}: UseResizableSidebarProps): UseResizableSidebarReturn {
  const [isSidebarVisible, setIsSidebarVisible] = useState(initialVisible);
  const [sidebarWidth, setSidebarWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarWidthRef = useRef(sidebarWidth);
  sidebarWidthRef.current = sidebarWidth;

  const persistSnapshot = useCallback(
    (visible: boolean, width: number) => {
      onPersist?.({ visible, width });
    },
    [onPersist]
  );

  const toggleSidebar = useCallback(() => {
    setIsSidebarVisible((prev) => {
      const next = !prev;
      persistSnapshot(next, sidebarWidthRef.current);
      return next;
    });
  }, [persistSnapshot]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      setSidebarWidth(Math.min(Math.max(newWidth, 320), 800));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      persistSnapshot(isSidebarVisible, sidebarWidthRef.current);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, isSidebarVisible, persistSnapshot]);

  return {
    isSidebarVisible,
    sidebarWidth,
    isResizing,
    toggleSidebar,
    setIsSidebarVisible,
    handleResizeStart,
  };
}
