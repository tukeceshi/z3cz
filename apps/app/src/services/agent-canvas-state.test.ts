import type {
  Edge as ReactFlowEdge,
  Node as ReactFlowNode,
} from "@xyflow/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  WorkflowEdgeType,
  WorkflowNodeType,
} from "@/components/workflow/workflow-types";
import { resolveResourceIdsOnServer } from "@/services/resolve-resource-ids-on-server";

import {
  AGENT_CANVAS_EXCERPT_MAX_CHARS,
  CANVAS_GET_STATE_TOOL,
  CANVAS_RESOLVE_RESOURCE_TOOL,
  compactCanvasAgentState,
  executeCanvasAgentTool,
  formatCanvasInventory,
  parseAgentToolCall,
  truncateAgentCanvasExcerpt,
} from "./agent-canvas-state";

vi.mock("@/services/resolve-resource-ids-on-server", () => ({
  resolveResourceIdsOnServer: vi.fn(),
}));

const resolveMock = vi.mocked(resolveResourceIdsOnServer);

function textNode(
  id: string,
  name: string,
  excerpt: string
): ReactFlowNode<WorkflowNodeType> {
  return {
    id,
    position: { x: 0, y: 0 },
    data: {
      name,
      nodeType: "ai-text",
      inputs: [],
      outputs: [{ id: "text", name: "text", type: "string", value: excerpt }],
      executionState: "idle",
    },
  };
}

function imageNode(
  id: string,
  name: string,
  resourceId: string
): ReactFlowNode<WorkflowNodeType> {
  return {
    id,
    position: { x: 0, y: 0 },
    data: {
      name,
      nodeType: "ai-image",
      inputs: [
        {
          id: "images_result",
          name: "images_result",
          type: "any",
          value: [{ resourceId, mimeType: "image/png" }],
        },
      ],
      outputs: [{ id: "images", name: "images", type: "image" }],
      executionState: "idle",
    },
  };
}

describe("truncateAgentCanvasExcerpt", () => {
  it("cuts text longer than 120 characters", () => {
    const text = "字".repeat(AGENT_CANVAS_EXCERPT_MAX_CHARS + 8);
    const excerpt = truncateAgentCanvasExcerpt(text);
    expect(
      excerpt?.startsWith("字".repeat(AGENT_CANVAS_EXCERPT_MAX_CHARS))
    ).toBe(true);
    expect(excerpt?.endsWith("…")).toBe(true);
    expect(excerpt?.length).toBe(AGENT_CANVAS_EXCERPT_MAX_CHARS + 1);
  });
});

describe("compactCanvasAgentState", () => {
  it("lists id, type, name, resourceId and edges without urls", () => {
    const nodes = [
      imageNode("n1", "图1", "res-1"),
      textNode("n2", "文1", "一段说明"),
    ];
    const edges: ReactFlowEdge<WorkflowEdgeType>[] = [
      {
        id: "e1",
        source: "n1",
        target: "n2",
        data: {},
      },
    ];
    const summary = compactCanvasAgentState(nodes, edges);
    expect(summary.nodes[0]).toEqual({
      id: "n1",
      type: "ai-image",
      name: "图1",
      resourceId: "res-1",
    });
    expect(JSON.stringify(summary)).not.toContain("blob:");
    expect(JSON.stringify(summary)).not.toContain("http");
    expect(summary.nodes[1]?.excerpt).toBe("一段说明");
    expect(summary.edges).toEqual([{ from: "n1", to: "n2" }]);
  });
});

describe("formatCanvasInventory", () => {
  it("lists node id, type and name", () => {
    const summary = compactCanvasAgentState(
      [imageNode("n1", "图1", "res-1")],
      []
    );
    expect(formatCanvasInventory(summary)).toContain("n1 ai-image 图1");
  });
});

describe("parseAgentToolCall", () => {
  it("reads tool name and resourceId", () => {
    expect(
      parseAgentToolCall(`${CANVAS_RESOLVE_RESOURCE_TOOL}\nresourceId: abc`)
    ).toEqual({
      name: CANVAS_RESOLVE_RESOURCE_TOOL,
      resourceId: "abc",
      nodeId: "",
      payload: "resourceId: abc",
    });
    expect(parseAgentToolCall(CANVAS_GET_STATE_TOOL)).toEqual({
      name: CANVAS_GET_STATE_TOOL,
      resourceId: "",
      nodeId: "",
      payload: "",
    });
  });

  it("keeps remotion source indentation after the tool name", () => {
    const source = `function Composition() {\n  return (\n    <AbsoluteFill />\n  );\n}`;
    expect(parseAgentToolCall(`remotion_write\n${source}`)).toEqual({
      name: "remotion_write",
      resourceId: "",
      nodeId: "",
      payload: source,
    });
  });
});

describe("executeCanvasAgentTool", () => {
  beforeEach(() => {
    resolveMock.mockReset();
  });

  it("returns the snapshot for get_state without resolving addresses", async () => {
    const snapshot = compactCanvasAgentState(
      [imageNode("n1", "图1", "res-1")],
      []
    );
    const text = await executeCanvasAgentTool({
      call: {
        name: CANVAS_GET_STATE_TOOL,
        resourceId: "",
        nodeId: "",
        payload: "",
      },
      snapshot,
      organizationId: "org",
    });
    expect(JSON.parse(text)).toEqual(snapshot);
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it("rejects unknown tools", async () => {
    const text = await executeCanvasAgentTool({
      call: {
        name: "canvas_delete_nodes",
        resourceId: "",
        nodeId: "",
        payload: "",
      },
      snapshot: { nodes: [], edges: [] },
    });
    expect(JSON.parse(text).error).toContain("未知工具");
  });

  it("does not resolve when resourceId is missing", async () => {
    const text = await executeCanvasAgentTool({
      call: {
        name: CANVAS_RESOLVE_RESOURCE_TOOL,
        resourceId: "",
        nodeId: "",
        payload: "",
      },
      snapshot: { nodes: [], edges: [] },
      organizationId: "org",
    });
    expect(JSON.parse(text).error).toContain("resourceId");
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it("resolves one resourceId through the existing server helper", async () => {
    resolveMock.mockResolvedValue({
      resolved: [
        {
          resourceId: "res-1",
          url: "https://example.test/res-1",
          mimeType: "image/png",
        },
      ],
      unresolved: [],
    });
    const text = await executeCanvasAgentTool({
      call: {
        name: CANVAS_RESOLVE_RESOURCE_TOOL,
        resourceId: "res-1",
        nodeId: "",
        payload: "",
      },
      snapshot: { nodes: [], edges: [] },
      organizationId: "org",
    });
    expect(resolveMock).toHaveBeenCalledWith({
      organizationId: "org",
      resourceIds: ["res-1"],
    });
    expect(JSON.parse(text)).toEqual({
      resourceId: "res-1",
      url: "https://example.test/res-1",
      mimeType: "image/png",
    });
  });

  it("rejects writes while still in plan mode", async () => {
    const writeSource = vi.fn();
    const text = await executeCanvasAgentTool({
      call: {
        name: "remotion_write",
        resourceId: "",
        nodeId: "",
        payload: "function Composition() { return null; }",
      },
      snapshot: { nodes: [], edges: [] },
      capabilities: {
        sessionMode: "plan",
        consentedCapabilities: ["simple-animation"],
        viewportOpen: true,
        requestConsent: async () => ({ authorized: false, open: false }),
        readSource: async () => "",
        writeSource,
      },
    });
    expect(JSON.parse(text).error).toContain("模式：方案");
    expect(writeSource).not.toHaveBeenCalled();
  });

  it("rejects write when the window is closed", async () => {
    const writeSource = vi.fn();
    const text = await executeCanvasAgentTool({
      call: {
        name: "remotion_write",
        resourceId: "",
        nodeId: "",
        payload: "function Composition() { return null; }",
      },
      snapshot: { nodes: [], edges: [] },
      capabilities: {
        sessionMode: "agent",
        consentedCapabilities: ["simple-animation"],
        viewportOpen: false,
        requestConsent: async () => ({ authorized: true, open: true }),
        readSource: async () => "",
        writeSource,
      },
    });
    expect(JSON.parse(text).error).toContain("窗口已关闭");
    expect(writeSource).not.toHaveBeenCalled();
  });

  it("opens the simple animation window without a second allow step", async () => {
    const requestConsent = vi.fn(async () => ({
      authorized: true as const,
      open: true as const,
    }));
    const text = await executeCanvasAgentTool({
      call: {
        name: "remotion_open",
        resourceId: "",
        nodeId: "",
        payload: "",
      },
      snapshot: { nodes: [], edges: [] },
      capabilities: {
        sessionMode: "agent",
        consentedCapabilities: [],
        viewportOpen: false,
        requestConsent,
        readSource: async () => "",
        writeSource: async () => ({ ok: true }),
      },
    });
    expect(requestConsent).toHaveBeenCalledWith("simple-animation");
    expect(JSON.parse(text)).toEqual({ authorized: true, open: true });
  });
});
