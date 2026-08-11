import { mergeBootstrapSettings } from "@dafthunk/types";
import { describe, expect, it } from "vitest";

import {
  buildBootstrapShellSources,
  parseBootstrapSettings,
} from "./bootstrap-settings";

describe("bootstrap-settings", () => {
  it("builds origin-only sources when r2 is disabled", () => {
    const settings = mergeBootstrapSettings({
      r2Enabled: false,
      accountId: "acc",
      accessKeyId: "key",
      secretAccessKeyEncrypted: "enc",
      bucketName: "bucket",
      publicBaseUrl: "https://cdn.example.com",
    });

    const sources = buildBootstrapShellSources(
      "/assets/shell-deadbeef.gz",
      settings
    );

    expect(sources).toEqual([
      { url: "/assets/shell-deadbeef.gz", kind: "origin" },
    ]);
  });

  it("includes r2 source when enabled and configured", () => {
    const settings = mergeBootstrapSettings({
      r2Enabled: true,
      accountId: "acc",
      accessKeyId: "key",
      secretAccessKeyEncrypted: "enc",
      bucketName: "bucket",
      publicBaseUrl: "https://cdn.example.com",
    });

    const sources = buildBootstrapShellSources(
      "/assets/shell-deadbeef.gz",
      settings
    );

    expect(sources).toEqual([
      { url: "/assets/shell-deadbeef.gz", kind: "origin" },
      {
        url: "https://cdn.example.com/shell-deadbeef.gz",
        kind: "r2",
      },
    ]);
  });

  it("parses stored JSON settings and ignores legacy fields", () => {
    const parsed = parseBootstrapSettings(
      JSON.stringify({
        shellEnabled: false,
        multiSourceRaceEnabled: false,
        originBaseUrl: "https://legacy.example.com",
        r2Enabled: true,
      })
    );
    expect(parsed.r2Enabled).toBe(true);
  });
});
