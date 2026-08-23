import { afterEach, describe, expect, it } from "vitest";

import {
  createStableBlobUrl,
  dropStableBlobUrlsForMediaId,
  stagingBlobUrlKey,
} from "./media-display-blob-url-registry";
import { resolveStableMediaDisplayUrlSet } from "./resolve-resource-display-url";
import { resetWorkflowMediaAddressCatalog } from "./workflow-media-address-catalog";

const organizationId = "org-thumb";
const workflowId = "wf-thumb";
const mediaId = "local-thumb-1";

afterEach(() => {
  dropStableBlobUrlsForMediaId(mediaId);
  resetWorkflowMediaAddressCatalog();
});

describe("resolveStableMediaDisplayUrlSet", () => {
  it("reuses a staging preview already created for the same media", () => {
    const url = createStableBlobUrl(
      stagingBlobUrlKey({ organizationId, workflowId, mediaId }),
      new Blob(["x"], { type: "image/png" })
    );

    const set = resolveStableMediaDisplayUrlSet({
      media: { resourceId: mediaId, mimeType: "image/png" },
      organizationId,
      workflowId,
    });

    expect(set.full).toBe(url);
  });
});
