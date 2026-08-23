import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EMPTY_WORKFLOW_MEDIA_ADDRESS,
  forgetWorkflowMediaFromCatalog,
  getWorkflowMediaUrlSet,
  hasRememberedDisplayThumb,
  initWorkflowMediaAddressCatalog,
  isWorkflowMediaAddressCatalogReady,
  mediaDisplayUrlSetsEqual,
  patchWorkflowMediaUrlSet,
  populateWorkflowMediaThumbBlobs,
  recallMediaDisplayUrlSet,
  rememberMediaDisplayUrlSet,
  resetWorkflowMediaAddressCatalog,
} from "./workflow-media-address-catalog";

const scope = {
  organizationId: "org-1",
  workflowId: "wf-1",
} as const;

afterEach(() => {
  resetWorkflowMediaAddressCatalog();
});

describe("workflow-media-address-catalog", () => {
  it("initializes thumb addresses from a single batch load", async () => {
    const blobS = new Blob(["s"], { type: "image/jpeg" });
    await initWorkflowMediaAddressCatalog(scope, async () => [
      {
        mediaId: "media-1",
        thumbs: { s: blobS, m: null, l: null },
      },
    ]);

    expect(isWorkflowMediaAddressCatalogReady(scope)).toBe(true);
    const set = getWorkflowMediaUrlSet(scope, "media-1");
    expect(set.s).toMatch(/^blob:/);
    expect(set.m).toBeNull();
    expect(set.full).toBeNull();
  });

  it("recalls remembered thumb sets", () => {
    populateWorkflowMediaThumbBlobs({
      ...scope,
      items: [
        {
          mediaId: "media-1",
          thumbs: {
            s: new Blob(["s"], { type: "image/jpeg" }),
            m: null,
            l: null,
          },
        },
      ],
    });

    const urlSet = getWorkflowMediaUrlSet(scope, "media-1");
    rememberMediaDisplayUrlSet({ ...scope, mediaId: "media-1", urlSet });
    expect(recallMediaDisplayUrlSet({ ...scope, mediaId: "media-1" })).toEqual(
      urlSet
    );
  });

  it("does not remember an empty set", () => {
    rememberMediaDisplayUrlSet({
      ...scope,
      mediaId: "media-1",
      urlSet: EMPTY_WORKFLOW_MEDIA_ADDRESS,
    });
    expect(recallMediaDisplayUrlSet({ ...scope, mediaId: "media-1" })).toBeNull();
  });

  it("forgets sets for a media id", () => {
    patchWorkflowMediaUrlSet({
      ...scope,
      mediaId: "media-1",
      urlSet: { full: "blob:full" },
    });
    forgetWorkflowMediaFromCatalog("media-1");
    expect(getWorkflowMediaUrlSet(scope, "media-1")).toEqual(
      EMPTY_WORKFLOW_MEDIA_ADDRESS
    );
  });

  it("compares url sets by address", () => {
    const left = { full: "a", s: "b", m: null, l: null };
    expect(mediaDisplayUrlSetsEqual(left, { ...left })).toBe(true);
    expect(mediaDisplayUrlSetsEqual(left, { ...left, s: "c" })).toBe(false);
    expect(hasRememberedDisplayThumb(left)).toBe(true);
    expect(
      hasRememberedDisplayThumb({ full: null, s: null, m: "m", l: null })
    ).toBe(false);
  });

  it("dedupes concurrent init for the same workflow", async () => {
    const loader = vi.fn(async () => [] as const);
    await Promise.all([
      initWorkflowMediaAddressCatalog(scope, loader),
      initWorkflowMediaAddressCatalog(scope, loader),
    ]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("finishes init with an empty catalog when batch load fails", async () => {
    await initWorkflowMediaAddressCatalog(scope, async () => {
      throw new Error("indexeddb failed");
    });

    expect(isWorkflowMediaAddressCatalogReady(scope)).toBe(true);
    expect(getWorkflowMediaUrlSet(scope, "media-1")).toEqual(
      EMPTY_WORKFLOW_MEDIA_ADDRESS
    );
  });

  it("discards stale workflow thumb batches after switching workflows", async () => {
    const scopeB = {
      organizationId: "org-1",
      workflowId: "wf-b",
    } as const;
    let resolveA: ((value: readonly []) => void) | undefined;
    const loadA = vi.fn(
      () =>
        new Promise<readonly []>((resolve) => {
          resolveA = resolve;
        })
    );
    const blobS = new Blob(["s"], { type: "image/jpeg" });

    void initWorkflowMediaAddressCatalog(scope, loadA);
    await initWorkflowMediaAddressCatalog(scopeB, async () => [
      {
        mediaId: "media-b",
        thumbs: { s: blobS, m: null, l: null },
      },
    ]);

    expect(isWorkflowMediaAddressCatalogReady(scopeB)).toBe(true);
    expect(getWorkflowMediaUrlSet(scopeB, "media-b").s).toMatch(/^blob:/);

    resolveA?.([]);
    await Promise.resolve();

    expect(isWorkflowMediaAddressCatalogReady(scopeB)).toBe(true);
    expect(getWorkflowMediaUrlSet(scopeB, "media-b").s).toMatch(/^blob:/);
    expect(getWorkflowMediaUrlSet(scope, "media-a")).toEqual(
      EMPTY_WORKFLOW_MEDIA_ADDRESS
    );
  });
});
