import { mergeBootstrapSettings } from "@dafthunk/types";
import { describe, expect, it } from "vitest";

import type { Bindings } from "../context";
import { buildBootstrapStorageUrlMap } from "./bootstrap-storage-sources";

const ENV = {} as Bindings;

describe("buildBootstrapStorageUrlMap", () => {
  it("returns R2 public URLs for the current build assets", async () => {
    const settings = mergeBootstrapSettings({
      r2Enabled: true,
      accountId: "acc",
      accessKeyId: "key",
      secretAccessKeyEncrypted: "enc",
      bucketName: "bucket",
      publicBaseUrl: "https://cdn.example.com/",
    });

    const map = await buildBootstrapStorageUrlMap(
      ["/assets/shell.gz", "/landing/dollface.jpg", "/assets/shell.gz"],
      settings,
      ENV
    );

    expect([...map.entries()]).toEqual([
      [
        "/assets/shell.gz",
        { url: "https://cdn.example.com/shell.gz", kind: "r2" },
      ],
      [
        "/landing/dollface.jpg",
        { url: "https://cdn.example.com/landing/dollface.jpg", kind: "r2" },
      ],
    ]);
  });

  it("does not invent TOS URLs without signing", async () => {
    const settings = mergeBootstrapSettings({
      r2Enabled: true,
      storageProvider: "tos",
      tosRegion: "cn-guangzhou",
      tosAccessKeyId: "key",
      tosSecretAccessKeyEncrypted: "",
      tosBucketName: "bucket",
    });

    const map = await buildBootstrapStorageUrlMap(
      ["/assets/shell.gz"],
      settings,
      ENV
    );

    expect(map.size).toBe(0);
  });
});
