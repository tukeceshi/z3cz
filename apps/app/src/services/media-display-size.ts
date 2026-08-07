export type MediaDisplaySize =
  | "thumb"
  | "full"
  | "canvas-s"
  | "canvas-m"
  | "canvas-l";

export function isCanvasDisplaySize(
  size: MediaDisplaySize
): size is "canvas-s" | "canvas-m" | "canvas-l" {
  return size === "canvas-s" || size === "canvas-m" || size === "canvas-l";
}
