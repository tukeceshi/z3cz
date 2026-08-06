import type {
  AiInterfaceRuntimeArtifact,
  ResolvedOrgAiInterface,
} from "@dafthunk/types";

import { buildBodyFromSlots } from "./build-body";
import { readDotPath } from "./extract-path";
import {
  fetchWithUpstreamLog,
  type UpstreamRequestLogSink,
} from "./upstream-request-log";

export function resolveSyncRequestUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.trim().replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (normalizedBase.endsWith(normalizedPath)) {
    return normalizedBase;
  }

  return `${normalizedBase}${normalizedPath}`;
}

export interface AiInterfaceSyncExecutionResult {
  readonly status: "completed" | "failed";
  readonly outputs?: Readonly<Record<string, unknown>>;
  readonly usage?: number;
  readonly error?: string;
}

export async function executeAiInterfaceSync(params: {
  resolved: ResolvedOrgAiInterface;
  inputs: Readonly<Record<string, unknown>>;
  readonly bodyExtensions?: Readonly<Record<string, unknown>>;
  readonly upstreamLog?: UpstreamRequestLogSink;
}): Promise<AiInterfaceSyncExecutionResult> {
  const { resolved, inputs } = params;
  const artifact = resolved.artifact;

  if (artifact.execution.mode !== "sync") {
    return { status: "failed", error: "Only sync templates are supported" };
  }

  const sync = artifact.execution.sync;
  const bodyResult = buildBodyFromSlots({
    slots: sync.bodySlots,
    inputs,
    model: resolved.selectedModel,
    fields: artifact.fields,
  });

  if ("error" in bodyResult) {
    const failure = bodyResult as { error: string };
    return { status: "failed", error: failure.error };
  }

  const url = resolveSyncRequestUrl(resolved.baseUrl, sync.path);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...artifact.connection.defaultHeaders,
  };

  const authHeader = artifact.connection.headerName;
  headers[authHeader] = `${artifact.connection.authPrefix}${resolved.apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    artifact.connection.timeoutMs
  );

  try {
    const response = await fetchWithUpstreamLog(
      url,
      {
        method: sync.method,
        headers,
        body: JSON.stringify({
          ...bodyResult,
          ...(params.bodyExtensions ?? {}),
        }),
        signal: controller.signal,
      },
      params.upstreamLog
    );

    const text = await response.text();
    if (!response.ok) {
      return {
        status: "failed",
        error: `Upstream request failed (${response.status}): ${text}`,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      return { status: "failed", error: "Upstream returned non-JSON response" };
    }

    const responseText = readDotPath(parsed, sync.responseTextPath);
    if (typeof responseText !== "string") {
      return {
        status: "failed",
        error: "Could not extract text from upstream response",
      };
    }

    let usage = 1;
    if (sync.usagePromptPath && sync.usageCompletionPath) {
      const promptTokens = Number(readDotPath(parsed, sync.usagePromptPath) ?? 0);
      const completionTokens = Number(
        readDotPath(parsed, sync.usageCompletionPath) ?? 0
      );
      usage = Math.max(1, promptTokens + completionTokens);
    }

    const outputName = artifact.nodeType.outputs[0]?.name ?? "text";
    return {
      status: "completed",
      outputs: { [outputName]: responseText },
      usage,
    };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown upstream error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function mergeResolvedAiInterface(params: {
  artifact: AiInterfaceRuntimeArtifact;
  interfaceId: string;
  baseUrl?: string | null;
  selectedModel?: string | null;
  apiKey: string;
}): ResolvedOrgAiInterface {
  const { artifact } = params;
  return {
    interfaceId: params.interfaceId,
    templateId: artifact.templateId,
    templateVersion: artifact.version,
    baseUrl: (params.baseUrl ?? artifact.connection.baseUrl).replace(/\/$/, ""),
    apiKey: params.apiKey,
    selectedModel: params.selectedModel ?? artifact.nodeType.inputs.find(
      (input) => input.name === "model"
    )?.default as string ?? "",
    artifact,
  };
}
