import { AI_IMAGE_NODE_TYPE } from "@dafthunk/types";
import { describe, expect, it } from "vitest";

import type { WorkflowNodeType } from "@/components/workflow/workflow-types";

import { patchWorkflowNodeCloudAccelerationPending } from "./patch-node-cloud-acceleration-pending";

describe("patchWorkflowNodeCloudAccelerationPending", () => {
  it("writes pending cloud acceleration and clears generating", () => {
    const node: WorkflowNodeType = {
      name: "Image",
      nodeType: AI_IMAGE_NODE_TYPE,
      executionState: "idle",
      inputs: [
        {
          id: "images_result",
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
          id: "images_history",
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
      ],
      outputs: [{ id: "images", name: "images", type: "json", value: [] }],
    };

    const patch = patchWorkflowNodeCloudAccelerationPending(node);
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
