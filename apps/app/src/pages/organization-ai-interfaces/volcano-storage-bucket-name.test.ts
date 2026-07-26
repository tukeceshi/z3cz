import { describe, expect, it } from "vitest";

import { resolveNewTosBucketName } from "./volcano-storage-bucket-name";

describe("resolveNewTosBucketName", () => {
  const organizationId = "019f8866-5300-77c4-9ce2-abc1061ef26a";

  it("returns a globally unique org-scoped bucket name", () => {
    const name = resolveNewTosBucketName([], organizationId);
    expect(name.startsWith("z3cz-com-019f88665300-")).toBe(true);
    expect(name).not.toBe("z3cz-com");
  });

  it("appends a new suffix when the generated name already exists locally", () => {
    const first = resolveNewTosBucketName([], organizationId);
    const second = resolveNewTosBucketName([first], organizationId);
    expect(second).not.toBe(first);
  });
});
