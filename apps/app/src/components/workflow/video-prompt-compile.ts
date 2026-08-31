import {
  snapVideoTrimSec,
  type VideoTrimRangeSec,
} from "@dafthunk/types";

/** Stored token: `{{ref:edgeId}}` — bound to a reference edge, not a slot index. */

export const VIDEO_PROMPT_REF_TOKEN_PATTERN = /\{\{ref:([^}]+)\}\}/g;

/** Trim clip is always the first entry in retake referenceVideoUrls. */
export const RETAKE_EDIT_TRIM_VIDEO_REF_INDEX = 1 as const;

export interface VideoPromptImageChipRef {
  readonly edgeId: string;
  readonly kind: string;
}

export type VideoPromptCompileResult =
  | { readonly ok: true; readonly prompt: string }
  | {
      readonly ok: false;
      readonly reason: "broken_ref";
      readonly brokenEdgeIds: readonly string[];
    };

export function formatVideoPromptImageRef(index: number): string {
  return `图片${index}`;
}

export function formatRetakeEditTrimSec(valueSec: number): string {
  return snapVideoTrimSec(valueSec).toFixed(1);
}

function formatRetakeEditClockSec(valueSec: number): string {
  const totalSec = Math.floor(snapVideoTrimSec(valueSec));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatRetakeEditTimeRangeLabel(range: VideoTrimRangeSec): string {
  return `${formatRetakeEditClockSec(range.startSec)}—${formatRetakeEditClockSec(range.endSec)}`;
}

export function formatRetakeEditSubmitPrefix(
  videoIndex: number = RETAKE_EDIT_TRIM_VIDEO_REF_INDEX
): string {
  return `编辑<视频${videoIndex}>`;
}

export function compileRetakePromptForSubmit(
  userStored: string,
  indexMap: ReadonlyMap<string, number>
): VideoPromptCompileResult {
  const userCompile = compileVideoPromptForSubmit(userStored, indexMap);
  if (!userCompile.ok) {
    return userCompile;
  }

  const userPart = userCompile.prompt.trim();
  const prefix = formatRetakeEditSubmitPrefix();
  if (userPart.length === 0) {
    return { ok: true, prompt: prefix };
  }

  return { ok: true, prompt: `${prefix}${userPart}` };
}

export function compiledRetakePromptLength(
  userStored: string,
  indexMap: ReadonlyMap<string, number>
): number | null {
  const result = compileRetakePromptForSubmit(userStored, indexMap);
  return result.ok ? result.prompt.length : null;
}

/** 1-based index of each image reference edge in connection order. */
export function buildVideoPromptImageEdgeIndexMap(
  chips: readonly VideoPromptImageChipRef[]
): ReadonlyMap<string, number> {
  const map = new Map<string, number>();
  let index = 1;
  for (const chip of chips) {
    if (chip.kind !== "image") continue;
    map.set(chip.edgeId, index);
    index += 1;
  }
  return map;
}

export function listBrokenVideoPromptRefEdgeIds(
  stored: string,
  indexMap: ReadonlyMap<string, number>
): readonly string[] {
  const broken: string[] = [];
  for (const match of stored.matchAll(VIDEO_PROMPT_REF_TOKEN_PATTERN)) {
    const edgeId = match[1];
    if (edgeId && !indexMap.has(edgeId)) {
      broken.push(edgeId);
    }
  }
  return broken;
}

export function hasBrokenVideoPromptRefs(
  stored: string,
  indexMap: ReadonlyMap<string, number>
): boolean {
  return listBrokenVideoPromptRefEdgeIds(stored, indexMap).length > 0;
}

export function compileVideoPromptForSubmit(
  stored: string,
  indexMap: ReadonlyMap<string, number>
): VideoPromptCompileResult {
  const brokenEdgeIds = listBrokenVideoPromptRefEdgeIds(stored, indexMap);
  if (brokenEdgeIds.length > 0) {
    return { ok: false, reason: "broken_ref", brokenEdgeIds };
  }

  const prompt = stored.replace(VIDEO_PROMPT_REF_TOKEN_PATTERN, (_match, edgeId: string) => {
    const index = indexMap.get(edgeId);
    return index === undefined ? _match : formatVideoPromptImageRef(index);
  });

  return { ok: true, prompt };
}

export function compiledVideoPromptLength(
  stored: string,
  indexMap: ReadonlyMap<string, number>
): number | null {
  const result = compileVideoPromptForSubmit(stored, indexMap);
  return result.ok ? result.prompt.length : null;
}

export function appendVideoPromptRefToken(
  stored: string,
  edgeId: string
): string {
  const token = `{{ref:${edgeId}}}`;
  if (stored.length === 0) return token;
  const needsSpace = !/\s$/.test(stored);
  return `${stored}${needsSpace ? " " : ""}${token}`;
}

export function stripVideoPromptRefTokenPrefix(stored: string): string {
  return stored.replace(/@$/, "");
}
