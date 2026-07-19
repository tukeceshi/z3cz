import { describe, expect, it } from "vitest";

import {
  DEFAULT_NEW_TOS_BUCKET_NAME,
  resolveNewTosBucketName,
} from "./volcano-storage-bucket-name";

describe("resolveNewTosBucketName", () => {
  it("returns the default name when unused", () => {
    expect(resolveNewTosBucketName([])).toBe(DEFAULT_NEW_TOS_BUCKET_NAME);
    expect(resolveNewTosBucketName(["other-bucket"])).toBe(
      DEFAULT_NEW_TOS_BUCKET_NAME
    );
  });

  it("appends a suffix when the default name already exists", () => {
    const name = resolveNewTosBucketName([DEFAULT_NEW_TOS_BUCKET_NAME]);
    expect(name).not.toBe(DEFAULT_NEW_TOS_BUCKET_NAME);
    expect(name.startsWith(`${DEFAULT_NEW_TOS_BUCKET_NAME}-`)).toBe(true);
  });
});
