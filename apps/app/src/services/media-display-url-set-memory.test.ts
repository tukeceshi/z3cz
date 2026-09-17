import { afterEach, describe, expect, it } from "vitest";

import {
  forgetMediaDisplayUrlSetsForMediaId,
  hasRememberedDisplayThumb,
  mediaDisplayUrlSetsEqual,
  recallMediaDisplayUrlSet,
  rememberMediaDisplayUrlSet,
} from "./media-display-url-set-memory";
import {
  populateWorkflowMediaThumbBlobs,
  resetWorkflowMediaAddressCatalog,
} from "./workflow-media-address-catalog";

const base = {
  organizationId: "org-1",
  workflowId: "wf-1",
  mediaId: "media-1",
} as const;

afterEach(() => {
  forgetMediaDisplayUrlSetsForMediaId(base.mediaId);
  resetWorkflowMediaAddressCatalog();
});

function activateCatalog(): void {
  populateWorkflowMediaThumbBlobs({
    organizationId: base.organizationId,
    workflowId: base.workflowId,
    items: [],
  });
}

describe("media-display-url-set-memory", () => {
  it("recalls a remembered thumb set by media id", () => {
    activateCatalog();
    const urlSet = { full: "blob:full", s: "blob:s", m: null, l: null };
    rememberMediaDisplayUrlSet({ ...base, urlSet });

    expect(recallMediaDisplayUrlSet(base)).toEqual(urlSet);
  });

  it("does not remember an empty set", () => {
    rememberMediaDisplayUrlSet({
      ...base,
      urlSet: { full: null, s: null, m: null, l: null },
    });

    expect(recallMediaDisplayUrlSet(base)).toBeNull();
  });

  it("forgets sets for a media id", () => {
    activateCatalog();
    rememberMediaDisplayUrlSet({
      ...base,
      urlSet: { full: "blob:full", s: null, m: null, l: null },
    });
    forgetMediaDisplayUrlSetsForMediaId(base.mediaId);

    expect(recallMediaDisplayUrlSet(base)).toBeNull();
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
});
