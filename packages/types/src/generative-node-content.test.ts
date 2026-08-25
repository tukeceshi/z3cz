import { describe, expect, it } from "vitest";

import {
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
} from "./ai-interface";
import {
  appendImageGeneratingContent,
  appendTextGeneratingContent,
  appendVideoGeneratingContent,
  buildGeneratingResourceRefs,
  finalizeImageGeneratingContent,
  mergeGenerativeNodeContentOnSave,
  patchNodeMediaResourceKinds,
  patchNodeMediaCloudAccelerationStatus,
} from "./generative-node-content";
import type { Node } from "./workflow";

function createImageNode(inputs: Node["inputs"] = []): Node {
  return {
    id: "node-1",
    name: "Image",
    type: AI_IMAGE_NODE_TYPE,
    position: { x: 0, y: 0 },
    inputs,
    outputs: [{ name: "images", type: "json", value: [] }],
  };
}

describe("appendImageGeneratingContent", () => {
  it("writes matching card media and history row", () => {
    const node = createImageNode();
    const patch = appendImageGeneratingContent(node, {
      resourceIds: ["res-1"],
      prompt: "a cat",
      jobId: "job-1",
      platformModelId: "model-1",
    });
    expect(patch).not.toBeNull();

    const history = (patch!.inputs!.find((input) => input.name === "images_history")
      ?.value ?? null) as { items: { images: { resourceId: string; generating?: boolean }[] }[] };
    const result = patch!.inputs!.find((input) => input.name === "images_result")?.value as
      | { resourceId: string; generating?: boolean }[]
      | undefined;

    expect(history.items[0]?.images[0]).toEqual({
      resourceId: "res-1",
      mimeType: "image/png",
      generating: true,
      kind: "ephemeral",
    });
    expect(result?.[0]).toEqual(history.items[0]?.images[0]);
  });

  it("is idempotent for the same job", () => {
    const node = createImageNode();
    const first = appendImageGeneratingContent(node, {
      resourceIds: ["res-1"],
      prompt: "a cat",
      jobId: "job-1",
    });
    const merged = { ...node, ...first };
    const second = appendImageGeneratingContent(merged, {
      resourceIds: ["res-1"],
      prompt: "a cat",
      jobId: "job-1",
    });
    expect(second).toBeNull();
  });
});

describe("appendVideoGeneratingContent", () => {
  it("uses resource refs for card and history", () => {
    const node: Node = {
      id: "node-2",
      name: "Video",
      type: AI_VIDEO_NODE_TYPE,
      position: { x: 0, y: 0 },
      inputs: [],
      outputs: [{ name: "videos", type: "json", value: [] }],
    };
    const patch = appendVideoGeneratingContent(node, {
      resourceIds: ["vid-1"],
      jobId: "job-v",
      mimeType: "video/mp4",
      prompt: "run",
    });
    expect(patch).not.toBeNull();
    const result = patch!.inputs!.find((input) => input.name === "videos_result")
      ?.value as { resourceId: string; generating?: boolean }[];
    expect(result[0]).toEqual({
      resourceId: "vid-1",
      mimeType: "video/mp4",
      generating: true,
      kind: "ephemeral",
    });
  });
});

describe("buildGeneratingResourceRefs", () => {
  it("marks refs as generating", () => {
    expect(buildGeneratingResourceRefs(["a"], "image/png")).toEqual([
      { resourceId: "a", mimeType: "image/png", generating: true, kind: "ephemeral" },
    ]);
  });
});

describe("patchNodeMediaResourceKinds", () => {
  it("writes catalog kind onto matching image refs", () => {
    const node = createImageNode([
      {
        name: "images_result",
        type: "json",
        value: [
          {
            resourceId: "res-1",
            mimeType: "image/png",
            generating: true,
            kind: "ephemeral",
          },
        ],
      },
      {
        name: "images_history",
        type: "json",
        value: {
          selectedId: "gen-1",
          items: [
            {
              id: "gen-1",
              images: [
                {
                  resourceId: "res-1",
                  mimeType: "image/png",
                  generating: true,
                  kind: "ephemeral",
                },
              ],
              prompt: "",
              createdAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        },
      },
    ]);

    const patch = patchNodeMediaResourceKinds(
      node,
      new Map([["res-1", "cloud"]])
    );
    expect(patch).not.toBeNull();
    const result = patch!.inputs!.find((input) => input.name === "images_result")
      ?.value as { kind?: string }[];
    expect(result[0]?.kind).toBe("cloud");
    expect(result[0]).not.toHaveProperty("generating");
  });
});

describe("patchNodeMediaCloudAccelerationStatus", () => {
  it("clears generating and writes cloud acceleration on matching refs", () => {
    const node = createImageNode([
      {
        name: "images_result",
        type: "json",
        value: [
          {
            resourceId: "res-1",
            mimeType: "image/png",
            generating: true,
            kind: "ephemeral",
          },
        ],
      },
      {
        name: "images_history",
        type: "json",
        value: {
          selectedId: "gen-1",
          items: [
            {
              id: "gen-1",
              images: [
                {
                  resourceId: "res-1",
                  mimeType: "image/png",
                  generating: true,
                  kind: "ephemeral",
                },
              ],
              prompt: "a cat",
              createdAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        },
      },
    ]);

    const patch = patchNodeMediaCloudAccelerationStatus(node, {
      resourceIds: ["res-1"],
      status: "pending",
    });

    expect(patch).not.toBeNull();
    const result = patch!.inputs!.find((input) => input.name === "images_result")
      ?.value as {
      resourceId: string;
      generating?: boolean;
      cloudAccelerationStatus?: string;
    }[];
    expect(result[0]).toEqual({
      resourceId: "res-1",
      mimeType: "image/png",
      kind: "ephemeral",
      cloudAccelerationStatus: "pending",
    });
  });
});

describe("finalizeImageGeneratingContent", () => {
  it("replaces generating history rows with final cloud media", () => {
    const node = createImageNode([
      {
        name: "images_result",
        type: "json",
        value: [
          {
            resourceId: "res-1",
            mimeType: "image/png",
            generating: true,
            kind: "ephemeral",
          },
        ],
      },
      {
        name: "images_history",
        type: "json",
        value: {
          selectedId: "gen-1",
          items: [
            {
              id: "gen-1",
              images: [
                {
                  resourceId: "res-1",
                  mimeType: "image/png",
                  generating: true,
                  kind: "ephemeral",
                  cloudAccelerationStatus: "pending",
                },
              ],
              prompt: "a cat",
              createdAt: "2026-01-01T00:00:00.000Z",
              jobId: "job-1",
            },
          ],
        },
      },
    ]);

    const patch = finalizeImageGeneratingContent(node, {
      jobId: "job-1",
      resourceIds: ["res-1"],
      media: [
        {
          resourceId: "res-1",
          mimeType: "image/png",
          kind: "cloud",
        },
      ],
    });

    expect(patch).not.toBeNull();
    const history = patch!.inputs!.find((input) => input.name === "images_history")
      ?.value as {
      items: {
        images: { resourceId: string; kind?: string; generating?: boolean; cloudAccelerationStatus?: string }[];
        jobId?: string;
      }[];
    };
    expect(history.items[0]?.images[0]).toEqual({
      resourceId: "res-1",
      mimeType: "image/png",
      kind: "cloud",
    });
    expect(history.items[0]?.jobId).toBeUndefined();
  });
});

describe("mergeGenerativeNodeContentOnSave", () => {
  it("preserves in-flight history rows missing from incoming save", () => {
    const persisted = createImageNode([
      {
        name: "images_result",
        type: "json",
        value: [{ resourceId: "res-1", mimeType: "image/png", generating: true }],
      },
      {
        name: "images_history",
        type: "json",
        value: {
          selectedId: "gen-server",
          items: [
            {
              id: "gen-server",
              images: [{ resourceId: "res-1", generating: true }],
              prompt: "",
              createdAt: "2026-01-01T00:00:00.000Z",
              jobId: "job-1",
            },
          ],
        },
      },
    ]);
    const incoming = createImageNode([
      {
        name: "images_result",
        type: "json",
        value: [{ resourceId: "old-done", mimeType: "image/jpeg" }],
      },
      {
        name: "images_history",
        type: "json",
        value: { selectedId: "old-done-id", items: [] },
      },
    ]);

    const merged = mergeGenerativeNodeContentOnSave(persisted, incoming);
    const history = merged.inputs.find((input) => input.name === "images_history")
      ?.value as { items: { id: string }[]; selectedId: string | null };
    expect(history.items.some((item) => item.id === "gen-server")).toBe(true);
    expect(history.selectedId).toBe("gen-server");
    const result = merged.inputs.find((input) => input.name === "images_result")
      ?.value as { resourceId: string; generating?: boolean }[];
    expect(result[0]?.generating).toBe(true);
  });
});

describe("appendTextGeneratingContent", () => {
  it("writes the placeholder resource id on history and result", () => {
    const node: Node = {
      id: "node-text",
      name: "Text",
      type: AI_TEXT_NODE_TYPE,
      position: { x: 0, y: 0 },
      inputs: [],
      outputs: [{ name: "text", type: "string" }],
    };
    const patch = appendTextGeneratingContent(node, {
      invocationId: "inv-1",
      resourceId: "text-res-1",
      platformModelId: "model-1",
    });
    expect(patch).not.toBeNull();

    const history = (patch!.inputs!.find((input) => input.name === "result_history")
      ?.value ?? null) as {
      items: { resourceId?: string; invocationId?: string }[];
    };
    const result = patch!.inputs!.find((input) => input.name === "result")?.value as
      | { resourceId: string; generating?: boolean }
      | undefined;

    expect(history.items[0]?.resourceId).toBe("text-res-1");
    expect(history.items[0]?.invocationId).toBe("inv-1");
    expect(result).toEqual({
      resourceId: "text-res-1",
      mimeType: "text/plain",
      generating: true,
    });
  });
});
