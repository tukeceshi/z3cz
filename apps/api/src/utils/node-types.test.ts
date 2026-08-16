import { describe, expect, it, vi } from "vitest";

import type { Bindings } from "../context";

vi.mock("../runtime/cloudflare-node-registry", () => ({
  createCloudflareNodeRegistry: vi.fn(),
}));

import { createCloudflareNodeRegistry } from "../runtime/cloudflare-node-registry";
import { getAllNodeTypes } from "./node-types";

function createNodeType(type: string) {
  return {
    id: type,
    name: type,
    type,
    tags: [],
    icon: "box",
    inputs: [],
    outputs: [],
  };
}

describe("node-types", () => {
  it("returns only core generative nodes (node runtime)", async () => {
    const env = {
      RUNTIME: "node",
    } as Bindings;

    const nodeTypes = await getAllNodeTypes(env);

    expect(nodeTypes.map((entry) => entry.type)).toEqual([
      "ai-text",
      "ai-image",
      "ai-video",
      "ai-audio",
    ]);
  });

  it("filters registry catalog on workers runtime", async () => {
    vi.mocked(createCloudflareNodeRegistry).mockResolvedValueOnce({
      getNodeTypes: () => [
        createNodeType("ai-text"),
        createNodeType("ai-image"),
        createNodeType("ai-video"),
        createNodeType("ai-audio"),
        createNodeType("http-request"),
      ],
    } as Awaited<ReturnType<typeof createCloudflareNodeRegistry>>);

    const env = {} as Bindings;
    const nodeTypes = await getAllNodeTypes(env);

    expect(nodeTypes.map((entry) => entry.type)).toEqual([
      "ai-text",
      "ai-image",
      "ai-video",
      "ai-audio",
    ]);
  });
});
