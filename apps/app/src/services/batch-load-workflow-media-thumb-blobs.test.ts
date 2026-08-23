import { describe, expect, it } from "vitest";

import { CANVAS_TIER_SHORT_EDGE } from "@/services/canvas-media-tier";

import { collectWorkflowEntryThumbLookupKeys } from "./ai-media-cache-service";

describe("collectWorkflowEntryThumbLookupKeys", () => {
  it("returns canvas tier keys for one entry", () => {
    const entryKey = "org-1:wf-1:media-1";

    expect(collectWorkflowEntryThumbLookupKeys(entryKey)).toEqual([
      `${entryKey}|w${CANVAS_TIER_SHORT_EDGE.s}`,
      `${entryKey}|w${CANVAS_TIER_SHORT_EDGE.m}`,
      `${entryKey}|w${CANVAS_TIER_SHORT_EDGE.l}`,
    ]);
  });
});
