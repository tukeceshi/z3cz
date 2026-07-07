import type { Bindings } from "../context";

let nodeBindings: Bindings | null = null;

export function setNodeBindings(bindings: Bindings): void {
  nodeBindings = bindings;
}

export function getNodeBindings(): Bindings {
  if (!nodeBindings) {
    throw new Error("Node bindings are not initialized");
  }
  return nodeBindings;
}
