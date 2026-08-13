import type { ObjectReference } from "@dafthunk/types";
import { describe, expect, it } from "vitest";

import { cloudUploadToResourceId } from "./stage-generative-media";

describe("cloudUploadToResourceId", () => {
  it("uses ObjectReference.id as resourceId, not storageKey", () => {
    const object: ObjectReference = {
      id: "019ffa10-6ffa-710d-8b3d-a6351f6be0bc",
      mimeType: "image/jpeg",
      storageBackend: "volcengine_tos",
      storageKey:
        "z3cz/workflows/wf_019ffa06/ai-image/019ffa10-6ffa-710d-8b3d-a6351f6be0bc.jpg",
    };

    expect(cloudUploadToResourceId(object)).toEqual({
      resourceId: "019ffa10-6ffa-710d-8b3d-a6351f6be0bc",
      mimeType: "image/jpeg",
    });
  });
});
