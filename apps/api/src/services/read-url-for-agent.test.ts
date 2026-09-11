import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildOrganizeExtractPrompt,
  buildReadUrlPrompt,
  modelReadLooksUseful,
  nativeWebToolsForRead,
  readUrlForAgent,
} from "./read-url-for-agent";

vi.mock("./execute-text-model", () => ({
  executeTextModel: vi.fn(),
}));

vi.mock("./extract-url-readable", () => ({
  extractUrlReadable: vi.fn(),
}));

vi.mock("./resolve-text-model-interface", () => ({
  listOrgTextModelOptions: vi.fn(async () => []),
}));

vi.mock("../runtime/cloudflare-ai-interface-service", () => ({
  CloudflareAiInterfaceService: class {
    async resolveOrgInterface() {
      return { artifact: { provider: "doubao_volcano" } };
    }
  },
}));

import { executeTextModel } from "./execute-text-model";
import { extractUrlReadable } from "./extract-url-readable";

const executeMock = vi.mocked(executeTextModel);
const extractMock = vi.mocked(extractUrlReadable);

const usefulText = `标题：示例文章\n要点：页面讲了产品用法、注意事项和常见问题。\n正文：${"整理后的正文。".repeat(10)}`;

describe("nativeWebToolsForRead", () => {
  it("uses volcano web_search and gemini urlContext", () => {
    expect(
      nativeWebToolsForRead({
        provider: "doubao_volcano",
        canonicalId: "doubao-seed-1-8",
      })
    ).toEqual([{ type: "web_search" }]);
    expect(
      nativeWebToolsForRead({
        provider: "custom",
        canonicalId: "gemini-3-5-flash",
      })
    ).toEqual([{ urlContext: {} }]);
    expect(
      nativeWebToolsForRead({
        provider: "openai",
        canonicalId: "gpt-4.1",
      })
    ).toBeUndefined();
  });
});

describe("modelReadLooksUseful", () => {
  it("rejects short or refusal replies", () => {
    expect(modelReadLooksUseful("太短")).toBe(false);
    expect(modelReadLooksUseful(`${"x".repeat(80)}无法访问该链接`)).toBe(false);
    expect(modelReadLooksUseful(usefulText)).toBe(true);
  });
});

describe("read prompts", () => {
  it("includes the url", () => {
    expect(buildReadUrlPrompt("https://example.com")).toContain(
      "https://example.com"
    );
    expect(
      buildOrganizeExtractPrompt({
        url: "https://example.com",
        title: "示例",
        text: "正文",
      })
    ).toContain("正文");
  });
});

describe("readUrlForAgent", () => {
  beforeEach(() => {
    executeMock.mockReset();
    extractMock.mockReset();
  });

  it("returns model text when native read works", async () => {
    executeMock.mockResolvedValue({ ok: true, text: usefulText });
    const result = await readUrlForAgent({
      env: {} as never,
      db: {} as never,
      organizationId: "org",
      url: "https://example.com/page",
      modelCanonicalId: "doubao-seed-1-8",
      aiInterfaceId: "iface",
    });
    expect(result).toEqual({
      ok: true,
      text: usefulText,
      source: "model",
      url: "https://example.com/page",
    });
    expect(extractMock).not.toHaveBeenCalled();
  });

  it("falls back to local extract and organize", async () => {
    executeMock
      .mockResolvedValueOnce({ ok: false, error: "no web" })
      .mockResolvedValueOnce({ ok: true, text: usefulText });
    extractMock.mockResolvedValue({
      ok: true,
      url: "https://example.com/page",
      title: "示例",
      text: "抽出的正文".repeat(10),
    });
    const result = await readUrlForAgent({
      env: {} as never,
      db: {} as never,
      organizationId: "org",
      url: "https://example.com/page",
      modelCanonicalId: "doubao-seed-1-8",
      aiInterfaceId: "iface",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe("local");
      expect(result.text).toBe(usefulText);
    }
    expect(extractMock).toHaveBeenCalled();
  });

  it("returns extracted text when organize also fails", async () => {
    executeMock.mockResolvedValue({ ok: false, error: "fail" });
    extractMock.mockResolvedValue({
      ok: true,
      url: "https://example.com/page",
      title: "示例",
      text: "抽出的正文",
    });
    const result = await readUrlForAgent({
      env: {} as never,
      db: {} as never,
      organizationId: "org",
      url: "https://example.com/page",
      modelCanonicalId: "doubao-seed-1-8",
      aiInterfaceId: "iface",
    });
    expect(result).toEqual({
      ok: true,
      text: "示例\n\n抽出的正文",
      source: "local",
      title: "示例",
      url: "https://example.com/page",
    });
  });

  it("rejects invalid urls", async () => {
    await expect(
      readUrlForAgent({
        env: {} as never,
        db: {} as never,
        organizationId: "org",
        url: "not-a-url",
        modelCanonicalId: "doubao-seed-1-8",
        aiInterfaceId: "iface",
      })
    ).resolves.toEqual({
      ok: false,
      error: "无效的地址",
      status: 400,
    });
  });
});
