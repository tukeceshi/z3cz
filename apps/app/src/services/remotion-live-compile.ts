import * as Babel from "@babel/standalone";
import * as React from "react";
import { type ComponentType, createElement, type ReactNode } from "react";
import * as Remotion from "remotion";

export const REMOTION_DEFAULT_DURATION_FRAMES = 90;
export const REMOTION_DEFAULT_FPS = 30;
export const REMOTION_DEFAULT_WIDTH = 1280;
export const REMOTION_DEFAULT_HEIGHT = 720;

export interface RemotionCompiledComposition {
  readonly component: ComponentType;
  readonly durationInFrames: number;
  readonly fps: number;
  readonly width: number;
  readonly height: number;
}

export interface RemotionCompileSuccess extends RemotionCompiledComposition {
  readonly error?: undefined;
}

export interface RemotionCompileFailure {
  readonly component?: undefined;
  readonly error: string;
}

export type RemotionCompileResult =
  | RemotionCompileSuccess
  | RemotionCompileFailure;

const REMOTION_BINDINGS = `
const {
  AbsoluteFill,
  Audio,
  Composition,
  Img,
  OffthreadVideo,
  Sequence,
  Series,
  Video,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} = remotion;
`;

function formatCompileError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function CompositionMarker(_props: Record<string, unknown>): null {
  return null;
}

function isReactElement(
  value: unknown
): value is { readonly type: unknown; readonly props: { children?: unknown } } {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "props" in value
  );
}

function walkElements(
  node: unknown,
  visit: (props: Record<string, unknown>) => void
): void {
  if (node == null) {
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      walkElements(child, visit);
    }
    return;
  }
  if (!isReactElement(node)) {
    return;
  }
  if (node.type === CompositionMarker) {
    visit(node.props as Record<string, unknown>);
    return;
  }
  walkElements(node.props.children, visit);
}

function readPositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

function compositionFromProps(
  props: Record<string, unknown>
): RemotionCompiledComposition | string {
  if (typeof props.component !== "function") {
    return "Composition is missing a component.";
  }
  return {
    component: props.component as ComponentType,
    durationInFrames: readPositiveInt(
      props.durationInFrames,
      REMOTION_DEFAULT_DURATION_FRAMES
    ),
    fps: readPositiveInt(props.fps, REMOTION_DEFAULT_FPS),
    width: readPositiveInt(props.width, REMOTION_DEFAULT_WIDTH),
    height: readPositiveInt(props.height, REMOTION_DEFAULT_HEIGHT),
  };
}

export function compileRemotionSource(source: string): RemotionCompileResult {
  const trimmed = source.trim();
  if (!trimmed) {
    return { error: "Source code is empty." };
  }

  try {
    const transformed = Babel.transform(`${REMOTION_BINDINGS}\n${trimmed}`, {
      presets: ["react"],
      filename: "composition.jsx",
    }).code;

    if (!transformed) {
      return { error: "Transpilation produced no output." };
    }

    const remotionApi = {
      ...Remotion,
      Composition: CompositionMarker,
    };
    const run = new Function(
      "React",
      "remotion",
      `${transformed}
var root = typeof RemotionRoot === "function" ? RemotionRoot : typeof Root === "function" ? Root : null;
if (!root) { throw new Error("Define RemotionRoot that returns <Composition />."); }
return root();`
    ) as (react: typeof import("react"), remotion: typeof remotionApi) => unknown;

    const tree = run(React, remotionApi);
    let found: Record<string, unknown> | undefined;
    walkElements(tree, (props) => {
      if (!found) {
        found = props;
      }
    });
    if (!found) {
      return { error: "RemotionRoot must return <Composition />." };
    }
    const composition = compositionFromProps(found);
    if (typeof composition === "string") {
      return { error: composition };
    }
    return composition;
  } catch (error) {
    return { error: formatCompileError(error) };
  }
}

export function renderRemotionCompileError(message: string): ReactNode {
  return createElement(
    "div",
    {
      style: {
        alignItems: "center",
        color: "#fca5a5",
        display: "flex",
        fontFamily: "ui-monospace, monospace",
        fontSize: 12,
        height: "100%",
        justifyContent: "center",
        padding: 16,
        textAlign: "center",
        whiteSpace: "pre-wrap",
      },
    },
    message
  );
}
