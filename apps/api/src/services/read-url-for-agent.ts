import {
  isGeminiCanonicalId,
  isVolcanoAiInterfaceProvider,
  type WebReadResponse,
  type WebReadSource,
} from "@dafthunk/types";

import type { Bindings } from "../context";
import type { Database } from "../db";
import { executeTextModel } from "./execute-text-model";
import { extractUrlReadable } from "./extract-url-readable";
import { parseCanvasImportSourceUrl } from "./fetch-canvas-import-source";
import { listOrgTextModelOptions } from "./resolve-text-model-interface";
import { CloudflareAiInterfaceService } from "../runtime/cloudflare-ai-interface-service";

const MODEL_READ_MIN_CHARS = 40;

const MODEL_READ_REFUSAL =
  /无法访问|打不开该链|不能打开该链|无法打开该链|无法联网|没有联网|can't access|cannot access|unable to (browse|access|fetch|open)|i (don't|do not) have (access|the ability)|as an ai (language )?model/i;

export function nativeWebToolsForRead(params: {
  readonly provider: string;
  readonly canonicalId: string;
}): unknown[] | undefined {
  if (isVolcanoAiInterfaceProvider(params.provider)) {
    return [{ type: "web_search" }];
  }
  if (isGeminiCanonicalId(params.canonicalId)) {
    return [{ urlContext: {} }];
  }
  return undefined;
}

export function modelReadLooksUseful(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < MODEL_READ_MIN_CHARS) {
    return false;
  }
  return !MODEL_READ_REFUSAL.test(trimmed);
}

export function buildReadUrlPrompt(url: string): string {
  return `读取这个链接的页面内容，整理后返回标题、要点和正文。不要编造页面上没有的内容。链接：${url}`;
}

export function buildOrganizeExtractPrompt(params: {
  readonly url: string;
  readonly title: string;
  readonly text: string;
}): string {
  const titleLine = params.title ? `标题：${params.title}\n` : "";
  return `根据下面从网页抽出的正文整理成标题、要点和正文。保留事实，不要编造。\n地址：${params.url}\n${titleLine}正文：\n${params.text}`;
}

export interface ReadUrlForAgentParams {
  readonly env: Bindings;
  readonly db: Database;
  readonly organizationId: string;
  readonly url: string;
  readonly modelCanonicalId: string;
  readonly aiInterfaceId: string;
}

export type ReadUrlForAgentResult =
  | WebReadResponse
  | { readonly ok: false; readonly error: string; readonly status: 400 | 502 };

async function runModel(params: {
  readonly env: Bindings;
  readonly db: Database;
  readonly organizationId: string;
  readonly canonicalId: string;
  readonly interfaceId: string;
  readonly prompt: string;
  readonly tools?: unknown;
}): Promise<string | undefined> {
  const options = await listOrgTextModelOptions(
    params.db,
    params.organizationId
  );
  const modelOption = options.find(
    (entry) =>
      entry.canonicalId === params.canonicalId &&
      entry.interfaceId === params.interfaceId
  );
  const result = await executeTextModel({
    env: params.env,
    db: params.db,
    organizationId: params.organizationId,
    canonicalId: params.canonicalId,
    interfaceId: params.interfaceId,
    effectivePrompt: params.prompt,
    outputMaxTokens: modelOption?.parameterRules.outputMaxTokens,
    tools: params.tools,
  });
  if (!result.ok || !result.text) {
    return undefined;
  }
  return result.text.trim();
}

export async function readUrlForAgent(
  params: ReadUrlForAgentParams
): Promise<ReadUrlForAgentResult> {
  const parsed = parseCanvasImportSourceUrl(params.url);
  if ("error" in parsed) {
    return { ok: false, error: parsed.error, status: 400 };
  }
  const url = parsed.toString();

  const service = new CloudflareAiInterfaceService(params.env);
  const iface = await service.resolveOrgInterface({
    organizationId: params.organizationId,
    interfaceId: params.aiInterfaceId,
  });
  const tools = iface
    ? nativeWebToolsForRead({
        provider: iface.artifact.provider,
        canonicalId: params.modelCanonicalId,
      })
    : undefined;

  if (tools) {
    const modelText = await runModel({
      env: params.env,
      db: params.db,
      organizationId: params.organizationId,
      canonicalId: params.modelCanonicalId,
      interfaceId: params.aiInterfaceId,
      prompt: buildReadUrlPrompt(url),
      tools,
    });
    if (modelText && modelReadLooksUseful(modelText)) {
      return {
        ok: true,
        text: modelText,
        source: "model" satisfies WebReadSource,
        url,
      };
    }
  }

  const extracted = await extractUrlReadable(url);
  if (!extracted.ok) {
    return extracted;
  }

  const organized = await runModel({
    env: params.env,
    db: params.db,
    organizationId: params.organizationId,
    canonicalId: params.modelCanonicalId,
    interfaceId: params.aiInterfaceId,
    prompt: buildOrganizeExtractPrompt({
      url,
      title: extracted.title,
      text: extracted.text,
    }),
  });
  if (organized && modelReadLooksUseful(organized)) {
    return {
      ok: true,
      text: organized,
      source: "local",
      title: extracted.title,
      url,
    };
  }

  const fallback = extracted.title
    ? `${extracted.title}\n\n${extracted.text}`
    : extracted.text;
  return {
    ok: true,
    text: fallback,
    source: "local",
    title: extracted.title,
    url,
  };
}
