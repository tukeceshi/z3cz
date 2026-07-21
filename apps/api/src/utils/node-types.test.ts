import { describe, expect, it, vi } from "vitest";

import type { Bindings } from "../context";

vi.mock("../runtime/cloudflare-node-registry", () => ({
  createCloudflareNodeRegistry: vi.fn(),
}));

vi.mock("../runtime/node-types-from-json", () => ({
  loadNodeTypesFromJson: vi.fn(() => [
    {
      id: "ai-text",
      name: "ai-text",
      type: "ai-text",
      tags: [],
      icon: "box",
      inputs: [],
      outputs: [],
    },
    {
      id: "ai-image",
      name: "ai-image",
      type: "ai-image",
      tags: [],
      icon: "box",
      inputs: [],
      outputs: [],
    },
    {
      id: "ai-video",
      name: "ai-video",
      type: "ai-video",
      tags: [],
      icon: "box",
      inputs: [],
      outputs: [],
    },
    {
      id: "http-request",
      name: "http-request",
      type: "http-request",
      tags: [],
      icon: "box",
      inputs: [],
      outputs: [],
    },
  ]),
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
    ]);
  });

  it("filters registry catalog on workers runtime", async () => {
    vi.mocked(createCloudflareNodeRegistry).mockResolvedValueOnce({
      getNodeTypes: () => [
        createNodeType("ai-text"),
        createNodeType("ai-image"),
        createNodeType("ai-video"),
        createNodeType("http-request"),
      ],
    } as Awaited<ReturnType<typeof createCloudflareNodeRegistry>>);

    const env = {} as Bindings;
    const nodeTypes = await getAllNodeTypes(env);

    expect(nodeTypes.map((entry) => entry.type)).toEqual([
      "ai-text",
      "ai-image",
      "ai-video",
    ]);
  });
});
