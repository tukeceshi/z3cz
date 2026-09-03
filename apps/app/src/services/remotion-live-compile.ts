import * as Babel from "@babel/standalone";
import * as React from "react";
import { type ComponentType, createElement, type ReactNode } from "react";
import * as Remotion from "remotion";

export interface RemotionCompileSuccess {
  readonly component: ComponentType;
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

    const run = new Function(
      "React",
      "remotion",
      `${transformed}\nif (typeof Composition !== "function") { throw new Error("Define a function named Composition."); }\nreturn Composition;`
    ) as (react: typeof import("react"), remotion: typeof Remotion) => ComponentType;

    const component = run(React, Remotion);
    return { component };
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
