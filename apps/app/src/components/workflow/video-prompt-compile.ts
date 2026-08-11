/** Stored token: `{{ref:edgeId}}` — bound to a reference edge, not a slot index. */

export const VIDEO_PROMPT_REF_TOKEN_PATTERN = /\{\{ref:([^}]+)\}\}/g;

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
