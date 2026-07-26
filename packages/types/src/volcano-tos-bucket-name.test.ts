import { describe, expect, it } from "vitest";

import {
  buildVolcanoTosBucketNameCandidate,
  resolveNewVolcanoTosBucketName,
} from "./volcano-tos-bucket-name";

describe("volcano-tos-bucket-name", () => {
  const organizationId = "019f8866-5300-77c4-9ce2-abc1061ef26a";

  it("builds org-scoped bucket names with a unique suffix", () => {
    const name = buildVolcanoTosBucketNameCandidate(organizationId, "abc12345");
    expect(name.startsWith("z3cz-com-019f88665300-abc12345")).toBe(true);
    expect(name.length).toBeLessThanOrEqual(63);
  });

  it("avoids names already present in the account bucket list", () => {
    const first = resolveNewVolcanoTosBucketName([], organizationId);
    const second = resolveNewVolcanoTosBucketName([first], organizationId);
    expect(second).not.toBe(first);
    expect(second.startsWith("z3cz-com-")).toBe(true);
  });

  it("never returns the bare prefix without org and suffix", () => {
    expect(resolveNewVolcanoTosBucketName([], organizationId)).not.toBe("z3cz-com");
    expect(resolveNewVolcanoTosBucketName([], organizationId).startsWith("z3cz-com-")).toBe(
      true
    );
  });
});
