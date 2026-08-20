import { mergeBootstrapSettings } from "@dafthunk/types";
import { describe, expect, it } from "vitest";

import {
  applyStorageOnlyUpdateGuards,
  buildBootstrapShellSources,
  disableStaleStorageOnly,
  mergeBootstrapSettingsUpdate,
  parseBootstrapSettings,
  validateBootstrapSettingsUpdate,
} from "./bootstrap-settings";

const R2_READY = {
  r2Enabled: true,
  accountId: "acc",
  accessKeyId: "key",
  secretAccessKeyEncrypted: "enc",
  bucketName: "bucket",
  publicBaseUrl: "https://cdn.example.com",
} as const;

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
      settings,
      "v1"
    );

    expect(sources).toEqual([
      { url: "/assets/shell-deadbeef.gz", kind: "origin" },
    ]);
  });

  it("includes r2 source when enabled and configured", () => {
    const settings = mergeBootstrapSettings({
      ...R2_READY,
    });

    const sources = buildBootstrapShellSources(
      "/assets/shell-deadbeef.gz",
      settings,
      "v1"
    );

    expect(sources).toEqual([
      { url: "/assets/shell-deadbeef.gz", kind: "origin" },
      {
        url: "https://cdn.example.com/shell-deadbeef.gz",
        kind: "r2",
      },
    ]);
  });

  it("builds landing asset sources without a double slash", () => {
    const settings = mergeBootstrapSettings({
      ...R2_READY,
    });

    const sources = buildBootstrapShellSources(
      "/landing/dollface.jpg",
      settings,
      "v1"
    );

    expect(sources).toEqual([
      { url: "/landing/dollface.jpg", kind: "origin" },
      {
        url: "https://cdn.example.com/landing/dollface.jpg",
        kind: "r2",
      },
    ]);
  });

  it("uses storage only when enabled and the current build is synced", () => {
    const settings = mergeBootstrapSettings({
      ...R2_READY,
      r2Only: true,
      lastSyncShellHash: "v2",
    });

    const sources = buildBootstrapShellSources(
      "/assets/shell-deadbeef.gz",
      settings,
      "v2"
    );

    expect(sources).toEqual([
      {
        url: "https://cdn.example.com/shell-deadbeef.gz",
        kind: "r2",
      },
    ]);
  });

  it("keeps racing when storage-only is on but the current build is not synced", () => {
    const settings = mergeBootstrapSettings({
      ...R2_READY,
      r2Only: true,
      lastSyncShellHash: "v1",
    });

    const sources = buildBootstrapShellSources(
      "/assets/shell-deadbeef.gz",
      settings,
      "v2"
    );

    expect(sources).toEqual([
      { url: "/assets/shell-deadbeef.gz", kind: "origin" },
      {
        url: "https://cdn.example.com/shell-deadbeef.gz",
        kind: "r2",
      },
    ]);
  });

  it("turns off stale storage-only after a new pack", () => {
    const settings = mergeBootstrapSettings({
      ...R2_READY,
      r2Only: true,
      lastSyncShellHash: "v1",
    });

    const result = disableStaleStorageOnly(settings, "v2");
    expect(result.changed).toBe(true);
    expect(result.settings.r2Only).toBe(false);
  });

  it("rejects enabling storage-only before the current build is synced", () => {
    const settings = mergeBootstrapSettings({
      ...R2_READY,
      r2Only: true,
      lastSyncShellHash: "v1",
    });

    expect(() => validateBootstrapSettingsUpdate(settings, "v2")).toThrow(
      /Sync the current build/
    );
  });

  it("clears stale storage-only unless this save explicitly enables it", () => {
    const stale = mergeBootstrapSettings({
      ...R2_READY,
      r2Only: true,
      lastSyncShellHash: "v1",
    });

    const cleared = applyStorageOnlyUpdateGuards(stale, {}, "v2");
    expect(cleared.r2Only).toBe(false);

    const kept = applyStorageOnlyUpdateGuards(stale, { r2Only: true }, "v2");
    expect(kept.r2Only).toBe(true);
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
    expect(parsed.r2Only).toBe(false);
    expect(parsed.storageProvider).toBe("r2");
  });

  it("defaults missing storageProvider to r2", () => {
    expect(parseBootstrapSettings("{}").storageProvider).toBe("r2");
    expect(
      parseBootstrapSettings(JSON.stringify({ storageProvider: "s3" }))
        .storageProvider
    ).toBe("r2");
  });

  it("does not infer tos from leftover TOS credentials", () => {
    const parsed = parseBootstrapSettings(
      JSON.stringify({
        r2Enabled: true,
        tosRegion: "cn-guangzhou",
        tosAccessKeyId: "key",
        tosSecretAccessKeyEncrypted: "enc",
        tosBucketName: "bucket",
      })
    );
    expect(parsed.storageProvider).toBe("r2");
  });

  it("keeps an explicit r2 provider even when TOS credentials are present", () => {
    const parsed = parseBootstrapSettings(
      JSON.stringify({
        storageProvider: "r2",
        tosRegion: "cn-guangzhou",
        tosAccessKeyId: "key",
        tosSecretAccessKeyEncrypted: "enc",
        tosBucketName: "bucket",
      })
    );
    expect(parsed.storageProvider).toBe("r2");
  });

  it("reads an explicit tos provider back", () => {
    const parsed = parseBootstrapSettings(
      JSON.stringify({
        storageProvider: "tos",
        tosRegion: "cn-guangzhou",
        tosAccessKeyId: "key",
        tosSecretAccessKeyEncrypted: "enc",
        tosBucketName: "bucket",
      })
    );
    expect(parsed.storageProvider).toBe("tos");
  });

  it("builds origin-only TOS sources until signed URLs are supplied", () => {
    const settings = mergeBootstrapSettings({
      r2Enabled: true,
      storageProvider: "tos",
      tosRegion: "cn-guangzhou",
      tosAccessKeyId: "key",
      tosSecretAccessKeyEncrypted: "enc",
      tosBucketName: "bucket",
    });

    const sources = buildBootstrapShellSources(
      "/assets/shell-deadbeef.gz",
      settings,
      "v1"
    );

    expect(sources).toEqual([
      { url: "/assets/shell-deadbeef.gz", kind: "origin" },
    ]);
  });

  it("uses the supplied TOS signed URL and does not add an R2 source", () => {
    const settings = mergeBootstrapSettings({
      r2Enabled: true,
      storageProvider: "tos",
      tosRegion: "cn-guangzhou",
      tosAccessKeyId: "key",
      tosSecretAccessKeyEncrypted: "enc",
      tosBucketName: "bucket",
      accountId: "acc",
      accessKeyId: "r2-key",
      secretAccessKeyEncrypted: "r2-enc",
      bucketName: "r2-bucket",
      publicBaseUrl: "https://cdn.example.com",
    });
    const assetPath = "/assets/shell-deadbeef.gz";
    const tosUrl =
      "https://bucket.tos-cn-guangzhou.volces.com/shell-deadbeef.gz?X-Tos-Signature=abc";

    const sources = buildBootstrapShellSources(
      assetPath,
      settings,
      "v1",
      new Map([[assetPath, { url: tosUrl, kind: "tos" }]])
    );

    expect(sources).toEqual([
      { url: assetPath, kind: "origin" },
      { url: tosUrl, kind: "tos" },
    ]);
  });

  it("clears last sync and storage-only when switching storage providers", () => {
    const existing = mergeBootstrapSettings({
      ...R2_READY,
      r2Only: true,
      lastSyncAt: "2026-01-01T00:00:00.000Z",
      lastSyncShellHash: "v1",
    });

    const next = mergeBootstrapSettingsUpdate(existing, {
      storageProvider: "tos",
    });

    expect(next.storageProvider).toBe("tos");
    expect(next.lastSyncAt).toBeNull();
    expect(next.lastSyncShellHash).toBeNull();
    expect(next.lastSyncError).toBeNull();
    expect(next.r2Only).toBe(false);
    expect(next.accountId).toBe("acc");
  });

  it("records the selected storage provider on save", () => {
    const existing = mergeBootstrapSettings({
      ...R2_READY,
      storageProvider: "r2",
      tosRegion: "cn-guangzhou",
      tosAccessKeyId: "key",
      tosSecretAccessKeyEncrypted: "enc",
      tosBucketName: "bucket",
    });

    const toTos = mergeBootstrapSettingsUpdate(existing, {
      storageProvider: "tos",
    });
    expect(toTos.storageProvider).toBe("tos");
    expect(toTos.accountId).toBe("acc");
    expect(toTos.tosBucketName).toBe("bucket");

    const backToR2 = mergeBootstrapSettingsUpdate(toTos, {
      storageProvider: "r2",
    });
    expect(backToR2.storageProvider).toBe("r2");
    expect(backToR2.tosBucketName).toBe("bucket");
  });
});
