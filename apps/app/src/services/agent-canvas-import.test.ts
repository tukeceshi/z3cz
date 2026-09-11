import { describe, expect, it } from "vitest";

import {
  adaptCanvasImportDocument,
  imageMentionIndexMap,
  parseCanvasImportInput,
  rewritePromptImageMentions,
  sortImportConnections,
} from "./agent-canvas-import";

const featuredGraph = {
  title: "色卡旋转换装视频",
  nodes: [
    {
      id: "node-1",
      kind: "image",
      title: "图片节点",
      x: 10,
      y: 20,
      meta: { mediaUrl: "https://cdn.example/a.png" },
    },
    {
      id: "node-2",
      kind: "image",
      title: "第一套",
      x: 40,
      y: 20,
      meta: {
        prompt: "模特@图片1 身穿橙色短袖",
        mediaUrl: "https://cdn.example/b.png",
        settings: { modelId: "cmotfqnds0000gwg7q4dtt5u3" },
      },
    },
    {
      id: "node-6",
      kind: "text",
      title: "文本节点",
      x: 80,
      y: 20,
      meta: { content: "生成一条12秒视频", prompt: "生成一条12秒视频" },
    },
    {
      id: "node-12",
      kind: "video",
      title: "视频节点",
      x: 120,
      y: 20,
      meta: {
        prompt: "@视频1 是原视频，@文本1 是文本提示词，@图片1 是第一套，@图片2 是第二套。",
        mediaUrl: "https://cdn.example/out.mp4",
        settings: { modelId: "cmqw6sb6a09dax5s3y8s6vxgo" },
      },
    },
    {
      id: "node-16",
      kind: "audio",
      title: "参考音频",
      x: 160,
      y: 20,
      meta: { mediaUrl: "https://cdn.example/ref.mp3" },
    },
  ],
  edges: [
    { id: "e1", from: "node-1", to: "node-2" },
    { id: "e2", from: "node-2", to: "node-12", order: 1 },
    { id: "e3", from: "node-6", to: "node-12", order: 10 },
    { id: "e4", from: "node-16", to: "node-12" },
  ],
  groups: [{ id: "g1" }],
  stickers: [
    { id: "s1", html: "参考视频" },
    { id: "s2", html: "用 PRO" },
  ],
};

describe("parseCanvasImportInput", () => {
  it("reads url and replace mode", () => {
    expect(
      parseCanvasImportInput(
        JSON.stringify({
          url: "https://xj.quantv.com/api/canvas/public/featured/abc",
          mode: "replace",
        })
      )
    ).toEqual({
      url: "https://xj.quantv.com/api/canvas/public/featured/abc",
      document: undefined,
      mode: "replace",
    });
  });

  it("reads pasted json", () => {
    expect(
      parseCanvasImportInput(
        JSON.stringify({ json: { nodes: [{ id: "a", mode: "image" }] } })
      )
    ).toEqual({
      url: "",
      document: { nodes: [{ id: "a", mode: "image" }] },
    });
  });
});

describe("adaptCanvasImportDocument", () => {
  it("maps a public featured canvas wrapper", () => {
    const plan = adaptCanvasImportDocument({
      id: "cmtspfjjq1yo8gizq7e4j3nfo",
      title: "色卡旋转换装视频",
      graph: JSON.stringify(featuredGraph),
    });
    expect("error" in plan).toBe(false);
    if ("error" in plan) {
      return;
    }
    expect(plan.title).toBe("色卡旋转换装视频");
    expect(plan.nodes.map((node) => node.mode)).toEqual([
      "image",
      "image",
      "text",
      "video",
      "audio",
    ]);
    expect(plan.nodes[1]?.prompt).toContain("模特@图片1");
    expect(plan.nodes[3]?.url).toBe("https://cdn.example/out.mp4");
    expect(plan.connections).toHaveLength(4);
    expect(plan.skipped).toEqual([
      "跳过 2 条便签",
      "跳过分组",
      "跳过对方模型",
    ]);
  });

  it("maps local nodes and connections", () => {
    const plan = adaptCanvasImportDocument({
      nodes: [
        { id: "a", mode: "image", prompt: "猫", url: "https://cdn/a.png", x: 1, y: 2 },
        { id: "b", mode: "text", prompt: "文案" },
      ],
      connections: [{ from: "a", to: "b" }],
    });
    expect(plan).toEqual({
      title: "",
      nodes: [
        {
          id: "a",
          mode: "image",
          name: "",
          prompt: "猫",
          url: "https://cdn/a.png",
          mimeType: "image/png",
          x: 1,
          y: 2,
        },
        {
          id: "b",
          mode: "text",
          name: "",
          prompt: "文案",
          url: "",
          mimeType: "",
        },
      ],
      connections: [{ fromNodeId: "a", toNodeId: "b", order: 0 }],
      skipped: [],
    });
  });

  it("maps the featured sample node and edge counts", () => {
    const nodes = [
      "image",
      "image",
      "image",
      "image",
      "image",
      "text",
      "image",
      "image",
      "image",
      "image",
      "image",
      "video",
      "image",
      "image",
      "video",
      "audio",
    ].map((kind, index) => ({
      id: `node-${index + 1}`,
      kind,
      title: kind,
      x: index * 10,
      y: 0,
      meta: {
        prompt: kind === "video" ? "@图片1 @图片2 @文本1 @视频1" : "",
        mediaUrl: `https://cdn.example/${index + 1}.bin`,
        settings: { modelId: "foreign" },
      },
    }));
    const edges = [
      { from: "node-1", to: "node-2" },
      { from: "node-1", to: "node-3" },
      { from: "node-1", to: "node-4" },
      { from: "node-1", to: "node-5" },
      { from: "node-11", to: "node-10" },
      { from: "node-11", to: "node-9" },
      { from: "node-11", to: "node-7" },
      { from: "node-11", to: "node-8" },
      { from: "node-2", to: "node-12", order: 1 },
      { from: "node-3", to: "node-12", order: 2 },
      { from: "node-4", to: "node-12", order: 3 },
      { from: "node-5", to: "node-12", order: 4 },
      { from: "node-8", to: "node-12", order: 5 },
      { from: "node-7", to: "node-12", order: 6 },
      { from: "node-9", to: "node-12", order: 7 },
      { from: "node-10", to: "node-12", order: 8 },
      { from: "node-6", to: "node-12", order: 10 },
      { from: "node-14", to: "node-13" },
      { from: "node-15", to: "node-12" },
      { from: "node-13", to: "node-12" },
      { from: "node-16", to: "node-12" },
    ];
    const plan = adaptCanvasImportDocument({
      id: "cmtspfjjq1yo8gizq7e4j3nfo",
      title: "色卡旋转换装视频",
      graph: JSON.stringify({
        nodes,
        edges,
        stickers: [{}, {}, {}, {}, {}],
      }),
    });
    expect("error" in plan).toBe(false);
    if ("error" in plan) {
      return;
    }
    expect(plan.nodes).toHaveLength(16);
    expect(plan.connections).toHaveLength(21);
    expect(plan.nodes.filter((node) => node.mode === "image")).toHaveLength(12);
    expect(plan.nodes.filter((node) => node.mode === "video")).toHaveLength(2);
    expect(plan.skipped).toEqual(["跳过 5 条便签", "跳过对方模型"]);
    const intoVideo = sortImportConnections(
      plan.connections.filter((item) => item.toNodeId === "node-12")
    );
    expect(intoVideo.map((item) => item.fromNodeId)).toEqual([
      "node-2",
      "node-3",
      "node-4",
      "node-5",
      "node-8",
      "node-7",
      "node-9",
      "node-10",
      "node-6",
      "node-15",
      "node-13",
      "node-16",
    ]);
  });

  it("maps this product's node types", () => {
    const plan = adaptCanvasImportDocument({
      nodes: [
        {
          id: "t1",
          type: "ai-text",
          name: "脚本",
          position: { x: 8, y: 9 },
          inputs: [{ name: "prompt", value: "写旁白" }],
        },
      ],
      edges: [],
    });
    expect("error" in plan).toBe(false);
    if ("error" in plan) {
      return;
    }
    expect(plan.nodes).toEqual([
      {
        id: "t1",
        mode: "text",
        name: "脚本",
        prompt: "写旁白",
        url: "",
        mimeType: "",
        x: 8,
        y: 9,
      },
    ]);
  });
});

describe("rewritePromptImageMentions", () => {
  it("binds @图片N to connected image edges", () => {
    const map = imageMentionIndexMap(["edge-a", "edge-b"]);
    expect(
      rewritePromptImageMentions("@图片1 是第一套，@图片2 是第二套，@图片9 仍保留", map)
    ).toBe("{{ref:edge-a}} 是第一套，{{ref:edge-b}} 是第二套，@图片9 仍保留");
  });
});

describe("sortImportConnections", () => {
  it("orders incoming refs by order then source", () => {
    expect(
      sortImportConnections([
        { fromNodeId: "c", toNodeId: "v", order: 2 },
        { fromNodeId: "a", toNodeId: "v", order: 1 },
        { fromNodeId: "b", toNodeId: "v", order: 1 },
      ])
    ).toEqual([
      { fromNodeId: "a", toNodeId: "v", order: 1 },
      { fromNodeId: "b", toNodeId: "v", order: 1 },
      { fromNodeId: "c", toNodeId: "v", order: 2 },
    ]);
  });
});
