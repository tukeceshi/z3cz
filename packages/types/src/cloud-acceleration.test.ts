import { describe, expect, it } from "vitest";

import {
  isCloudStoredResource,
  isEphemeralTemporaryConnection,
  shouldCloudAccelerate,
} from "./cloud-acceleration";

describe("isEphemeralTemporaryConnection", () => {
  it("accepts ephemeral rows with upstream url", () => {
    expect(
      isEphemeralTemporaryConnection({
        kind: "ephemeral",
        upstreamUrl: "https://example.com/a.png",
      })
    ).toBe(true);
  });

  it("accepts generating ephemeral placeholders", () => {
    expect(
      isEphemeralTemporaryConnection({
        kind: "ephemeral",
        generating: true,
      })
    ).toBe(true);
  });

  it("rejects cloud rows", () => {
    expect(
      isEphemeralTemporaryConnection({
        kind: "cloud",
        upstreamUrl: "https://example.com/a.png",
      })
    ).toBe(false);
  });
});

describe("isCloudStoredResource", () => {
  it("accepts catalog cloud rows", () => {
    expect(isCloudStoredResource({ kind: "cloud" })).toBe(true);
  });

  it("rejects ephemeral rows", () => {
    expect(isCloudStoredResource({ kind: "ephemeral" })).toBe(false);
  });
});

describe("shouldCloudAccelerate", () => {
  it("requires cloud storage, list membership, and ephemeral resource", () => {
    expect(
      shouldCloudAccelerate({
        resourceEntry: {
          kind: "ephemeral",
          upstreamUrl: "https://example.com/a.png",
        },
        cloudConfigured: true,
        interfaceInAccelList: true,
      })
    ).toBe(true);
  });

  it("allows user-triggered acceleration without list membership", () => {
    expect(
      shouldCloudAccelerate({
        resourceEntry: {
          kind: "ephemeral",
          upstreamUrl: "https://example.com/a.png",
        },
        cloudConfigured: true,
        interfaceInAccelList: false,
        userTriggered: true,
      })
    ).toBe(true);
  });

  it("rejects when cloud storage is unavailable", () => {
    expect(
      shouldCloudAccelerate({
        resourceEntry: {
          kind: "ephemeral",
          upstreamUrl: "https://example.com/a.png",
        },
        cloudConfigured: false,
        interfaceInAccelList: true,
      })
    ).toBe(false);
  });

  it("does not accelerate resources already in cloud storage", () => {
    expect(
      shouldCloudAccelerate({
        resourceEntry: { kind: "cloud" },
        cloudConfigured: true,
        interfaceInAccelList: true,
        userTriggered: true,
      })
    ).toBe(false);
  });
});
