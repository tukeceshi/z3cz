import type { Node as ReactFlowNode } from "@xyflow/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  clearStudioReferenceDragSession,
  readStudioReferenceDragPayload,
  resolveStudioReferenceDragPayload,
  resolveStudioReferenceDragPayloadFromTransfer,
  setStudioReferenceDragSession,
  STUDIO_REFERENCE_DRAG_MIME,
  writeStudioReferenceDrag,
} from "./studio-reference-drag";
import type { WorkflowNodeType } from "./workflow-types";

function makeNode(
  nodeType: string,
  id = "node-1"
): Pick<ReactFlowNode<WorkflowNodeType>, "id" | "data"> {
  return {
    id,
    data: { nodeType, inputs: [], outputs: [] } as WorkflowNodeType,
  };
}

describe("studio-reference-drag", () => {
  afterEach(() => {
    clearStudioReferenceDragSession();
  });

  it("resolves default output handles by node type", () => {
    expect(resolveStudioReferenceDragPayload(makeNode("ai-text"))).toEqual({
      nodeId: "node-1",
      outputId: "text",
    });
    expect(resolveStudioReferenceDragPayload(makeNode("ai-image"))).toEqual({
      nodeId: "node-1",
      outputId: "images",
    });
    expect(resolveStudioReferenceDragPayload(makeNode("ai-video"))).toEqual({
      nodeId: "node-1",
      outputId: "videos",
    });
    expect(resolveStudioReferenceDragPayload(makeNode("ai-audio"))).toEqual({
      nodeId: "node-1",
      outputId: "audios",
    });
  });

  it("round-trips drag payload through DataTransfer", () => {
    const dataTransfer = {
      types: [] as string[],
      store: "",
      setData(type: string, value: string) {
        this.types = [type];
        this.store = value;
      },
      getData(type: string) {
        return type === STUDIO_REFERENCE_DRAG_MIME ? this.store : "";
      },
    } as unknown as DataTransfer;

    writeStudioReferenceDrag(dataTransfer, {
      nodeId: "a",
      outputId: "text",
    });

    expect(readStudioReferenceDragPayload(dataTransfer)).toEqual({
      nodeId: "a",
      outputId: "text",
    });
  });

  it("falls back to drag session when dragOver cannot read getData", () => {
    const dataTransfer = {
      types: [STUDIO_REFERENCE_DRAG_MIME],
      getData: () => "",
    } as unknown as DataTransfer;

    setStudioReferenceDragSession({ nodeId: "b", outputId: "images" });

    expect(resolveStudioReferenceDragPayloadFromTransfer(dataTransfer)).toEqual({
      nodeId: "b",
      outputId: "images",
    });
  });
});
