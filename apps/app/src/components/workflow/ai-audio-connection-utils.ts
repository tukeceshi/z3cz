import { snapGenerativeContentBorderPoint } from "./generative-node-content-geometry";

export function snapAiAudioPromptBorderPoint(node: {
  readonly internals: { readonly positionAbsolute: { readonly x: number; readonly y: number } };
  readonly measured?: { readonly width?: number; readonly height?: number };
  readonly width?: number;
  readonly height?: number;
  readonly data?: { readonly nodeType?: string };
}): { x: number; y: number } {
  return snapGenerativeContentBorderPoint(
    node as Parameters<typeof snapGenerativeContentBorderPoint>[0],
    "left"
  );
}
