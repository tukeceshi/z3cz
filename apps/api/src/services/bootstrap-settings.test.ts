import { mergeBootstrapSettings } from "@dafthunk/types";
import { describe, expect, it } from "vitest";

import {
  buildBootstrapShellSources,
  parseBootstrapSettings,
} from "./bootstrap-settings";

describe("bootstrap-settings", () => {
  it("builds origin-only sources when race is disabled", () => {
    const settings = mergeBootstrapSettings({
      multiSourceRaceEnabled: false,
      r2Enabled: true,
      accountId: "acc",
      accessKeyId: "key",
      secretAccessKeyEncrypted: "enc",
      bucketName: "bucket",
      publicBaseUrl: "https://cdn.example.com/bootstrap",
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
      multiSourceRaceEnabled: true,
      r2Enabled: true,
      accountId: "acc",
      accessKeyId: "key",
      secretAccessKeyEncrypted: "enc",
      bucketName: "bucket",
      publicBaseUrl: "https://cdn.example.com/bootstrap",
      originBaseUrl: "https://origin.example.com",
    });

    const sources = buildBootstrapShellSources(
      "/assets/shell-deadbeef.gz",
      settings
    );

    expect(sources).toEqual([
      {
        url: "https://origin.example.com/assets/shell-deadbeef.gz",
        kind: "origin",
      },
      {
        url: "https://cdn.example.com/bootstrap/shell-deadbeef.gz",
        kind: "r2",
      },
    ]);
  });

  it("parses stored JSON settings", () => {
    const parsed = parseBootstrapSettings(
      JSON.stringify({ shellEnabled: false, r2Enabled: true })
    );
    expect(parsed.shellEnabled).toBe(false);
    expect(parsed.r2Enabled).toBe(true);
  });
});
