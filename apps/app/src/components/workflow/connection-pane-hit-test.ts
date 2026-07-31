/**
 * React Flow's `connection.pointer` / unsapped `connection.to` are pane-local
 * coordinates (client minus the flow pane's bounding rect), not flow coords.
 */

export interface PaneHitTestContext {
  readonly domNode: HTMLElement | null;
}

/** Pane-local pointer → absolute viewport client coords for elementsFromPoint. */
export function panePointerToClient(
  panePointer: { readonly x: number; readonly y: number },
  domNode: HTMLElement | null
): { x: number; y: number } | null {
  if (!domNode) return null;
  const rect = domNode.getBoundingClientRect();
  return {
    x: panePointer.x + rect.left,
    y: panePointer.y + rect.top,
  };
}

/**
 * Node under the connection pointer (whole-card hit), using pane-local coords
 * from React Flow's connection state.
 */
export function nodeIdUnderPanePointer(
  panePointer: { readonly x: number; readonly y: number },
  context: PaneHitTestContext,
  elementsFromPoint: (x: number, y: number) => readonly Element[] = (x, y) =>
    typeof document === "undefined" ? [] : document.elementsFromPoint(x, y)
): string | null {
  const client = panePointerToClient(panePointer, context.domNode);
  if (!client) return null;

  for (const el of elementsFromPoint(client.x, client.y)) {
    const nodeEl = el.closest(".react-flow__node") as HTMLElement | null;
    const nodeId = nodeEl?.getAttribute("data-id");
    if (nodeId) return nodeId;
  }
  return null;
}
