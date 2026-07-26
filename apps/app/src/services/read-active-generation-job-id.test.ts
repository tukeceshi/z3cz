import { describe, expect, it } from "vitest";

import { readActiveGenerationJobId } from "./read-active-generation-job-id";
import { ApiRequestError } from "./utils";

describe("readActiveGenerationJobId", () => {
  it("returns job id for active generation conflicts", () => {
    expect(
      readActiveGenerationJobId(
        new ApiRequestError(
          "An active generation job already exists for this node",
          409,
          "active_generation_job_exists",
          "job-123"
        )
      )
    ).toBe("job-123");
  });

  it("returns undefined for unrelated errors", () => {
    expect(
      readActiveGenerationJobId(new ApiRequestError("Bad request", 400))
    ).toBeUndefined();
  });
});
