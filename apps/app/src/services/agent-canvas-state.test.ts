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
  READ_URL_TOOL,
  SIMPLE_ANIMATION_CAPABILITY,
  SIMPLE_ANIMATION_TOOL,
} from "./agent-capabilities";
import {
  AGENT_CANVAS_EXCERPT_MAX_CHARS,
  attachMakeToolInventory,
  CANVAS_GET_STATE_TOOL,
  CANVAS_IMPORT_NEEDS_MODE,
  CANVAS_IMPORT_NOT_SUPPORTED,
  CANVAS_RESOLVE_RESOURCE_TOOL,
  compactCanvasAgentState,
  EMPTY_SIMPLE_ANIMATION_SOURCE,
  executeCanvasAgentTool,
  formatCanvasInventory,
  generationPromptIsCanvasImport,
  mapWriteNodeConnections,
  parseAgentToolCall,
  parseWriteNodesInput,
  toolCallFromFunctionArgs,
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
  resourceId: string,
  prompt = ""
): ReactFlowNode<WorkflowNodeType> {
  return {
    id,
    position: { x: 0, y: 0 },
    data: {
      name,
      nodeType: "ai-image",
      inputs: [
        {
          id: "prompt",
          name: "prompt",
          type: "string",
          value: prompt,
        },
        {
          id: "images_result",
          name: "images_result",
          type: "any",
          value: resourceId
            ? [{ resourceId, mimeType: "image/png" }]
            : [],
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
      x: 0,
      y: 0,
      resourceId: "res-1",
    });
    expect(JSON.stringify(summary)).not.toContain("blob:");
    expect(JSON.stringify(summary)).not.toContain("http");
    expect(summary.nodes[1]?.excerpt).toBe("一段说明");
    expect(summary.nodes[0]?.empty).toBeUndefined();
    expect(summary.nodes[1]?.empty).toBeUndefined();
    expect(summary.edges).toEqual([{ from: "n1", to: "n2" }]);
  });

  it("marks nodes without prompt or media as empty and keeps prompt text", () => {
    const summary = compactCanvasAgentState(
      [
        imageNode("empty-1", "视频 8", ""),
        imageNode("filled-1", "图1", "", "一只猫"),
      ],
      []
    );
    expect(summary.nodes[0]).toEqual({
      id: "empty-1",
      type: "ai-image",
      name: "视频 8",
      x: 0,
      y: 0,
      empty: true,
    });
    expect(summary.nodes[1]).toEqual({
      id: "filled-1",
      type: "ai-image",
      name: "图1",
      x: 0,
      y: 0,
      prompt: "一只猫",
    });
    expect(formatCanvasInventory(summary)).toContain('"empty":true');
    expect(formatCanvasInventory(summary)).toContain("一只猫");
  });
});

describe("formatCanvasInventory", () => {
  it("lists node id, type, name, resourceId and edges", () => {
    const summary = compactCanvasAgentState(
      [imageNode("n1", "图1", "res-1")],
      [
        {
          id: "e1",
          source: "n1",
          target: "n1",
          data: {},
        },
      ]
    );
    const text = formatCanvasInventory(summary);
    expect(text).toContain("res-1");
    expect(text).toContain("ai-image");
    expect(text).toContain("图1");
    expect(text).toContain('"from":"n1"');
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
    const source = `function Scene() {
  return <AbsoluteFill />;
}
function RemotionRoot() {
  return (
    <Composition id="Main" component={Scene} durationInFrames={90} fps={30} width={1280} height={720} />
  );
}`;
    expect(parseAgentToolCall(`remotion_write\n${source}`)).toEqual({
      name: "remotion_write",
      resourceId: "",
      nodeId: "",
      payload: source,
    });
    expect(
      parseAgentToolCall(
        `${SIMPLE_ANIMATION_TOOL}\n${JSON.stringify({ action: "write", source })}`
      ).name
    ).toBe(SIMPLE_ANIMATION_TOOL);
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

  it("reads a url through the handler", async () => {
    const readUrl = vi.fn(async () => ({
      ok: true as const,
      text: "标题：示例\n要点：一",
    }));
    const text = await executeCanvasAgentTool({
      call: {
        name: READ_URL_TOOL,
        resourceId: "",
        nodeId: "",
        payload: JSON.stringify({ url: "https://example.com/page" }),
      },
      snapshot: { nodes: [], edges: [] },
      capabilities: {
        sessionMode: "ask",
        consentedCapabilities: [],
        requestConsent: async () => ({ authorized: false, open: false }),
        revokeConsent: async () => ({ authorized: false, open: false }),
        readSource: async () => "",
        writeSource: async () => ({ ok: false }),
        readUrl,
      },
    });
    expect(readUrl).toHaveBeenCalledWith("https://example.com/page");
    expect(JSON.parse(text)).toEqual({
      ok: true,
      text: "标题：示例\n要点：一",
    });
  });

  it("rejects read_url without a url", async () => {
    const text = await executeCanvasAgentTool({
      call: {
        name: READ_URL_TOOL,
        resourceId: "",
        nodeId: "",
        payload: "{}",
      },
      snapshot: { nodes: [], edges: [] },
    });
    expect(JSON.parse(text).error).toContain("url");
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

  it("writes live remotion source in draft after open, not a draft copy", async () => {
    const writeSource = vi.fn(async () => ({ ok: true }));
    const text = await executeCanvasAgentTool({
      call: {
        name: SIMPLE_ANIMATION_TOOL,
        resourceId: "",
        nodeId: "",
        payload: JSON.stringify({
          action: "write",
          source: "function Scene() { return null; }\nfunction RemotionRoot() { return <Composition id=\"Main\" component={Scene} durationInFrames={90} fps={30} width={1280} height={720} />; }",
        }),
      },
      snapshot: { nodes: [], edges: [] },
      capabilities: {
        sessionMode: "draft",
        consentedCapabilities: [SIMPLE_ANIMATION_CAPABILITY],
        requestConsent: async () => ({ authorized: false, open: false }),
        revokeConsent: async () => ({ authorized: true, open: false }),
        readSource: async () => "",
        writeSource,
      },
    });
    expect(JSON.parse(text)).toEqual({ ok: true });
    expect(writeSource).toHaveBeenCalled();
  });

  it("allows canvas reads in ask and still allows animation", async () => {
    const read = await executeCanvasAgentTool({
      call: {
        name: "canvas_get_state",
        resourceId: "",
        nodeId: "",
        payload: "",
      },
      snapshot: { nodes: [], edges: [] },
      capabilities: {
        sessionMode: "ask",
        consentedCapabilities: [],
        requestConsent: async () => ({ authorized: false, open: false }),
        revokeConsent: async () => ({ authorized: true, open: false }),
        readSource: async () => "",
        writeSource: async () => ({ ok: false }),
      },
    });
    expect(JSON.parse(read)).toEqual({ nodes: [], edges: [] });

    const write = await executeCanvasAgentTool({
      call: {
        name: SIMPLE_ANIMATION_TOOL,
        resourceId: "",
        nodeId: "",
        payload: JSON.stringify({
          action: "write",
          source: "export const A = 1;",
        }),
      },
      snapshot: { nodes: [], edges: [] },
      capabilities: {
        sessionMode: "ask",
        consentedCapabilities: [],
        requestConsent: async () => ({ authorized: false, open: false }),
        revokeConsent: async () => ({ authorized: true, open: false }),
        readSource: async () => "",
        writeSource: async () => ({ ok: true }),
      },
    });
    expect(JSON.parse(write)).toEqual({ pendingConfirm: true });
  });

  it("keeps simple_animation function args as json", () => {
    const args = JSON.stringify({
      action: "write",
      source: "export const A = 1;",
    });
    expect(toolCallFromFunctionArgs(SIMPLE_ANIMATION_TOOL, args)).toEqual({
      name: SIMPLE_ANIMATION_TOOL,
      resourceId: "",
      nodeId: "",
      payload: args,
    });
  });

  it("opens simple animation viewport without granting write", async () => {
    const requestConsent = vi.fn(async () => ({ authorized: true, open: true }));
    const showViewport = vi.fn();
    const text = await executeCanvasAgentTool({
      call: {
        name: SIMPLE_ANIMATION_TOOL,
        resourceId: "",
        nodeId: "",
        payload: JSON.stringify({ action: "open" }),
      },
      snapshot: { nodes: [], edges: [] },
      capabilities: {
        sessionMode: "draft",
        consentedCapabilities: [],
        showViewport,
        requestConsent,
        revokeConsent: async () => ({ authorized: true, open: false }),
        readSource: async () => "",
        writeSource: async () => ({ ok: true }),
      },
    });
    expect(showViewport).toHaveBeenCalled();
    expect(requestConsent).not.toHaveBeenCalled();
    expect(JSON.parse(text)).toEqual({ ok: true, open: true });
  });

  it("writes while simple animation is on even if the window is hidden", async () => {
    const writeSource = vi.fn(async () => ({ ok: true }));
    const text = await executeCanvasAgentTool({
      call: {
        name: SIMPLE_ANIMATION_TOOL,
        resourceId: "",
        nodeId: "",
        payload: JSON.stringify({
          action: "write",
          source: "function Scene() { return null; }\nfunction RemotionRoot() { return <Composition id=\"Main\" component={Scene} durationInFrames={90} fps={30} width={1280} height={720} />; }",
        }),
      },
      snapshot: { nodes: [], edges: [] },
      capabilities: {
        sessionMode: "real",
        consentedCapabilities: [SIMPLE_ANIMATION_CAPABILITY],
        requestConsent: async () => ({ authorized: true, open: true }),
        revokeConsent: async () => ({ authorized: true, open: false }),
        readSource: async () => "",
        writeSource,
      },
    });
    expect(JSON.parse(text)).toEqual({ ok: true });
    expect(writeSource).toHaveBeenCalled();
  });

  it("clears to a blank composition without returning old source", async () => {
    const writeSource = vi.fn(async () => ({ ok: true }));
    const readSource = vi.fn(async () => EMPTY_SIMPLE_ANIMATION_SOURCE);
    const text = await executeCanvasAgentTool({
      call: {
        name: SIMPLE_ANIMATION_TOOL,
        resourceId: "",
        nodeId: "",
        payload: JSON.stringify({ action: "clear" }),
      },
      snapshot: { nodes: [], edges: [] },
      capabilities: {
        sessionMode: "ask",
        consentedCapabilities: [SIMPLE_ANIMATION_CAPABILITY],
        requestConsent: async () => ({ authorized: true, open: true }),
        revokeConsent: async () => ({ authorized: true, open: false }),
        readSource,
        writeSource,
      },
    });
    expect(JSON.parse(text)).toEqual({ ok: true, cleared: true });
    expect(JSON.parse(text).sourceCode).toBeUndefined();
    expect(writeSource).toHaveBeenCalledWith(EMPTY_SIMPLE_ANIMATION_SOURCE);
    expect(readSource).not.toHaveBeenCalled();
  });

  it("pauses clear until the user confirms", async () => {
    const writeSource = vi.fn();
    const text = await executeCanvasAgentTool({
      call: {
        name: SIMPLE_ANIMATION_TOOL,
        resourceId: "",
        nodeId: "",
        payload: JSON.stringify({ action: "clear" }),
      },
      snapshot: { nodes: [], edges: [] },
      capabilities: {
        sessionMode: "ask",
        consentedCapabilities: [],
        requestConsent: async () => ({ authorized: true, open: true }),
        revokeConsent: async () => ({ authorized: true, open: false }),
        readSource: async () => "old",
        writeSource,
      },
    });
    expect(JSON.parse(text)).toEqual({ pendingConfirm: true });
    expect(writeSource).not.toHaveBeenCalled();
  });

  it("pauses write until the user confirms", async () => {
    const writeSource = vi.fn();
    const text = await executeCanvasAgentTool({
      call: {
        name: SIMPLE_ANIMATION_TOOL,
        resourceId: "",
        nodeId: "",
        payload: JSON.stringify({
          action: "write",
          source: "function Scene() { return null; }\nfunction RemotionRoot() { return <Composition id=\"Main\" component={Scene} durationInFrames={90} fps={30} width={1280} height={720} />; }",
        }),
      },
      snapshot: { nodes: [], edges: [] },
      capabilities: {
        sessionMode: "real",
        consentedCapabilities: [],
        requestConsent: async () => ({ authorized: true, open: true }),
        revokeConsent: async () => ({ authorized: true, open: false }),
        readSource: async () => "",
        writeSource,
      },
    });
    expect(JSON.parse(text)).toEqual({ pendingConfirm: true });
    expect(writeSource).not.toHaveBeenCalled();
  });

  it("pauses canvas writes until the user confirms", async () => {
    const writeText = vi.fn();
    const text = await executeCanvasAgentTool({
      call: {
        name: "canvas_write_text",
        resourceId: "",
        nodeId: "n1",
        payload: JSON.stringify({ nodeId: "n1", text: "hello" }),
      },
      snapshot: { nodes: [], edges: [] },
      capabilities: {
        sessionMode: "real",
        consentedCapabilities: [],
        requestConsent: async () => ({ authorized: false, open: false }),
        revokeConsent: async () => ({ authorized: true, open: false }),
        readSource: async () => "",
        writeSource: async () => ({ ok: true }),
        writeText,
      },
    });
    expect(JSON.parse(text)).toEqual({ pendingConfirm: true });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("creates a generation flow after canvas write is confirmed", async () => {
    const createGenerationFlow = vi.fn(async () => ({
      ok: true,
      nodeId: "n-new",
    }));
    const text = await executeCanvasAgentTool({
      call: {
        name: "canvas_create_generation_flow",
        resourceId: "",
        nodeId: "",
        payload: JSON.stringify({
          mode: "image",
          prompt: "一只猫",
          autoRun: true,
        }),
      },
      snapshot: { nodes: [], edges: [] },
      capabilities: {
        sessionMode: "real",
        consentedCapabilities: ["canvas-make"],
        requestConsent: async () => ({ authorized: false, open: false }),
        revokeConsent: async () => ({ authorized: true, open: false }),
        readSource: async () => "",
        writeSource: async () => ({ ok: true }),
        createGenerationFlow,
      },
    });
    expect(JSON.parse(text)).toEqual({
      ok: true,
      nodeId: "n-new",
      created: {
        kind: "generation",
        mode: "image",
        prompt: "一只猫",
      },
    });
    expect(createGenerationFlow).toHaveBeenCalledWith({
      mode: "image",
      prompt: "一只猫",
      referenceNodeIds: [],
      autoRun: true,
    });
  });

  it("rejects using generation flow to import a public canvas", async () => {
    const createGenerationFlow = vi.fn();
    const prompt =
      "导入公开画布内容并恢复其全部节点、文字、提示词、素材引用和连接关系： https://xj.quantv.com/api/canvas/public/featured/cmtspfjjq1yo8gizq7e4j3nfo";
    expect(generationPromptIsCanvasImport(prompt)).toBe(true);
    expect(
      generationPromptIsCanvasImport("一只穿橙色衬衫的模特三视图")
    ).toBe(false);
    const text = await executeCanvasAgentTool({
      call: {
        name: "canvas_create_generation_flow",
        resourceId: "",
        nodeId: "",
        payload: JSON.stringify({
          mode: "text",
          prompt,
        }),
      },
      snapshot: { nodes: [], edges: [] },
      capabilities: {
        sessionMode: "real",
        consentedCapabilities: ["canvas-make"],
        requestConsent: async () => ({ authorized: false, open: false }),
        revokeConsent: async () => ({ authorized: true, open: false }),
        readSource: async () => "",
        writeSource: async () => ({ ok: true }),
        createGenerationFlow,
      },
    });
    expect(JSON.parse(text)).toEqual({ error: CANVAS_IMPORT_NOT_SUPPORTED });
    expect(createGenerationFlow).not.toHaveBeenCalled();
  });

  it("asks for append or replace when importing onto a non-empty canvas", async () => {
    const text = await executeCanvasAgentTool({
      call: {
        name: "canvas_import",
        resourceId: "",
        nodeId: "",
        payload: JSON.stringify({
          url: "https://xj.quantv.com/api/canvas/public/featured/abc",
        }),
      },
      snapshot: {
        nodes: [
          {
            id: "n1",
            type: "ai-image",
            name: "已有",
            x: 0,
            y: 0,
          },
        ],
        edges: [],
      },
      capabilities: {
        sessionMode: "real",
        consentedCapabilities: ["canvas-make"],
        requestConsent: async () => ({ authorized: false, open: false }),
        revokeConsent: async () => ({ authorized: true, open: false }),
        readSource: async () => "",
        writeSource: async () => ({ ok: true }),
      },
    });
    expect(JSON.parse(text)).toEqual({ error: CANVAS_IMPORT_NEEDS_MODE });
  });

  it("fetches and applies an imported canvas without running generation", async () => {
    const fetchImportSource = vi.fn(async () => ({
      ok: true as const,
      document: {
        title: "色卡旋转换装视频",
        nodes: [
          { id: "a", mode: "image", prompt: "模特", url: "https://cdn/a.png" },
          { id: "b", mode: "video", prompt: "参考@图片1" },
        ],
        connections: [{ from: "a", to: "b" }],
      },
    }));
    const applyImport = vi.fn(async (input) => ({
      ok: true,
      title: input.plan.title,
      nodes: input.plan.nodes.map((node) => ({
        id: node.id,
        nodeId: `real-${node.id}`,
        mode: node.mode,
      })),
      connected: input.plan.connections.length,
      skipped: input.plan.skipped,
    }));
    const text = await executeCanvasAgentTool({
      call: {
        name: "canvas_import",
        resourceId: "",
        nodeId: "",
        payload: JSON.stringify({
          url: "https://xj.quantv.com/api/canvas/public/featured/cmtspfjjq1yo8gizq7e4j3nfo",
          mode: "replace",
        }),
      },
      snapshot: { nodes: [], edges: [] },
      capabilities: {
        sessionMode: "real",
        consentedCapabilities: ["canvas-make"],
        requestConsent: async () => ({ authorized: false, open: false }),
        revokeConsent: async () => ({ authorized: true, open: false }),
        readSource: async () => "",
        writeSource: async () => ({ ok: true }),
        fetchImportSource,
        applyImport,
      },
    });
    expect(fetchImportSource).toHaveBeenCalledWith(
      "https://xj.quantv.com/api/canvas/public/featured/cmtspfjjq1yo8gizq7e4j3nfo"
    );
    expect(applyImport).toHaveBeenCalledWith({
      replace: true,
      plan: expect.objectContaining({
        title: "色卡旋转换装视频",
        nodes: expect.arrayContaining([
          expect.objectContaining({ id: "a", mode: "image" }),
          expect.objectContaining({ id: "b", mode: "video" }),
        ]),
      }),
    });
    expect(JSON.parse(text)).toEqual({
      ok: true,
      title: "色卡旋转换装视频",
      nodes: [
        { id: "a", nodeId: "real-a", mode: "image" },
        { id: "b", nodeId: "real-b", mode: "video" },
      ],
      connected: 1,
      skipped: [],
      created: {
        kind: "import",
        title: "色卡旋转换装视频",
        nodes: [
          { id: "a", nodeId: "real-a", mode: "image" },
          { id: "b", nodeId: "real-b", mode: "video" },
        ],
        connected: 1,
        skipped: [],
      },
    });
  });

  it("attaches fresh inventory to make results but not confirm pauses", () => {
    expect(
      attachMakeToolInventory(
        "canvas_create_generation_flow",
        JSON.stringify({ ok: true, nodeId: "n1" }),
        "画布清单：\n新的"
      )
    ).toBe(
      JSON.stringify({
        ok: true,
        nodeId: "n1",
        canvasInventory: "画布清单：\n新的",
      })
    );
    expect(
      attachMakeToolInventory(
        "canvas_write_text",
        JSON.stringify({ pendingConfirm: true }),
        "画布清单：空"
      )
    ).toBe(JSON.stringify({ pendingConfirm: true }));
    expect(
      attachMakeToolInventory(
        "canvas_get_state",
        JSON.stringify({ nodes: [] }),
        "画布清单：空"
      )
    ).toBe(JSON.stringify({ nodes: [] }));
  });

  it("parses batch nodes and connections with aliases", () => {
    expect(
      parseWriteNodesInput(
        JSON.stringify({
          nodes: [
            { id: "a", mode: "image", prompt: "模特", url: "https://cdn/a.png" },
            { id: "b", mode: "text", prompt: "脚本", x: 10, y: 20 },
          ],
          connections: [{ from: "a", to: "b" }],
        })
      )
    ).toEqual({
      nodes: [
        {
          id: "a",
          mode: "image",
          prompt: "模特",
          url: "https://cdn/a.png",
          mimeType: "",
        },
        {
          id: "b",
          mode: "text",
          prompt: "脚本",
          url: "",
          mimeType: "",
          x: 10,
          y: 20,
        },
      ],
      connections: [{ fromNodeId: "a", toNodeId: "b" }],
    });
    expect(
      mapWriteNodeConnections(
        [
          { id: "a", nodeId: "real-a", mode: "image" },
          { id: "b", nodeId: "real-b", mode: "text" },
        ],
        [{ fromNodeId: "a", toNodeId: "b" }]
      )
    ).toEqual([{ fromNodeId: "real-a", toNodeId: "real-b" }]);
  });

  it("writes two nodes, stages media, connects by alias, and does not run", async () => {
    const writeNodes = vi.fn(async (input) => ({
      ok: true,
      nodes: input.nodes.map((node) => ({
        id: node.id,
        nodeId: `real-${node.id}`,
        mode: node.mode,
      })),
      connected: input.connections.length,
    }));
    const runNode = vi.fn();
    const text = await executeCanvasAgentTool({
      call: {
        name: "canvas_write_nodes",
        resourceId: "",
        nodeId: "",
        payload: JSON.stringify({
          nodes: [
            {
              id: "img",
              mode: "image",
              url: "https://cdn/a.png",
              mimeType: "image/png",
            },
            { id: "copy", mode: "text", prompt: "文案" },
          ],
          connections: [{ from: "img", to: "copy" }],
        }),
      },
      snapshot: { nodes: [], edges: [] },
      capabilities: {
        sessionMode: "real",
        consentedCapabilities: ["canvas-make"],
        requestConsent: async () => ({ authorized: false, open: false }),
        revokeConsent: async () => ({ authorized: true, open: false }),
        readSource: async () => "",
        writeSource: async () => ({ ok: true }),
        runNode,
        writeNodes,
      },
    });
    expect(writeNodes).toHaveBeenCalledWith({
      nodes: [
        {
          id: "img",
          mode: "image",
          prompt: "",
          url: "https://cdn/a.png",
          mimeType: "image/png",
        },
        {
          id: "copy",
          mode: "text",
          prompt: "文案",
          url: "",
          mimeType: "",
        },
      ],
      connections: [{ fromNodeId: "img", toNodeId: "copy" }],
    });
    expect(runNode).not.toHaveBeenCalled();
    expect(JSON.parse(text)).toEqual({
      ok: true,
      nodes: [
        { id: "img", nodeId: "real-img", mode: "image" },
        { id: "copy", nodeId: "real-copy", mode: "text" },
      ],
      connected: 1,
      created: {
        kind: "nodes",
        nodes: [
          { id: "img", nodeId: "real-img", mode: "image" },
          { id: "copy", nodeId: "real-copy", mode: "text" },
        ],
        connected: 1,
      },
    });
  });

  it("does not grant write when opening the viewport", async () => {
    const writeSource = vi.fn();
    const showViewport = vi.fn();
    const open = await executeCanvasAgentTool({
      call: {
        name: SIMPLE_ANIMATION_TOOL,
        resourceId: "",
        nodeId: "",
        payload: JSON.stringify({ action: "open" }),
      },
      snapshot: { nodes: [], edges: [] },
      capabilities: {
        sessionMode: "real",
        consentedCapabilities: [],
        showViewport,
        requestConsent: async () => ({ authorized: true, open: true }),
        revokeConsent: async () => ({ authorized: true, open: false }),
        readSource: async () => "",
        writeSource,
      },
    });
    expect(JSON.parse(open)).toEqual({ ok: true, open: true });
    expect(showViewport).toHaveBeenCalled();

    const write = await executeCanvasAgentTool({
      call: {
        name: SIMPLE_ANIMATION_TOOL,
        resourceId: "",
        nodeId: "",
        payload: JSON.stringify({
          action: "write",
          source: "function Scene() { return null; }\nfunction RemotionRoot() { return <Composition id=\"Main\" component={Scene} durationInFrames={90} fps={30} width={1280} height={720} />; }",
        }),
      },
      snapshot: { nodes: [], edges: [] },
      capabilities: {
        sessionMode: "real",
        consentedCapabilities: [],
        showViewport,
        requestConsent: async () => ({ authorized: true, open: true }),
        revokeConsent: async () => ({ authorized: true, open: false }),
        readSource: async () => "",
        writeSource,
      },
    });
    expect(JSON.parse(write)).toEqual({ pendingConfirm: true });
    expect(writeSource).not.toHaveBeenCalled();
  });

  it("closes the simple animation window without revoking write", async () => {
    const revokeConsent = vi.fn(async () => ({
      authorized: true as const,
      open: false as const,
    }));
    const hideViewport = vi.fn();
    const writeSource = vi.fn(async () => ({ ok: true }));
    const close = await executeCanvasAgentTool({
      call: {
        name: SIMPLE_ANIMATION_TOOL,
        resourceId: "",
        nodeId: "",
        payload: JSON.stringify({ action: "close" }),
      },
      snapshot: { nodes: [], edges: [] },
      capabilities: {
        sessionMode: "real",
        consentedCapabilities: [SIMPLE_ANIMATION_CAPABILITY],
        hideViewport,
        requestConsent: async () => ({ authorized: true, open: true }),
        revokeConsent,
        readSource: async () => "",
        writeSource,
      },
    });
    expect(revokeConsent).not.toHaveBeenCalled();
    expect(hideViewport).toHaveBeenCalled();
    expect(JSON.parse(close)).toEqual({ ok: true, open: false });

    const write = await executeCanvasAgentTool({
      call: {
        name: SIMPLE_ANIMATION_TOOL,
        resourceId: "",
        nodeId: "",
        payload: JSON.stringify({
          action: "write",
          source: "function Scene() { return null; }\nfunction RemotionRoot() { return <Composition id=\"Main\" component={Scene} durationInFrames={90} fps={30} width={1280} height={720} />; }",
        }),
      },
      snapshot: { nodes: [], edges: [] },
      capabilities: {
        sessionMode: "real",
        consentedCapabilities: [SIMPLE_ANIMATION_CAPABILITY],
        hideViewport,
        requestConsent: async () => ({ authorized: true, open: true }),
        revokeConsent,
        readSource: async () => "",
        writeSource,
      },
    });
    expect(JSON.parse(write)).toEqual({ ok: true });
    expect(writeSource).toHaveBeenCalled();
  });
});
