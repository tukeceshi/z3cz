import {
  buildTextModelFailureCardParts,
  buildTextModelInvocationErrorFromFailure,
  withSelectedModel,
  type ReferenceImageInline,
} from "@dafthunk/types";
import { executeAiInterfaceSync } from "@dafthunk/runtime/ai-interface/execute-sync";
import type { UpstreamRequestLogSink } from "@dafthunk/runtime/ai-interface/upstream-request-log";

import type { Bindings } from "../context";
import type { Database } from "../db";
import { resolveOrgModelInferenceModelId } from "./resolve-org-model-inference-id";
import { CloudflareAiInterfaceService } from "../runtime/cloudflare-ai-interface-service";
import {
  listOrgTextModelOptions,
  resolveOrgModelInterfaceCandidate,
  type TextModelInterfaceCandidate,
} from "./resolve-text-model-interface";

export interface ExecuteTextModelResult {
  readonly ok: boolean;
  readonly text?: string;
  readonly interfaceId?: string;
  readonly interfaceName?: string;
  /** Full card copy for nodes and canvas API responses. */
  readonly error?: string;
  /** Invocation log only — interpretation and upstream error, no retry hints. */
  readonly invocationError?: string;
}

async function executeTextModelCandidate(params: {
  readonly env: Bindings;
  readonly db: Database;
  readonly organizationId: string;
  readonly canonicalId: string;
  readonly candidate: TextModelInterfaceCandidate;
  readonly effectivePrompt: string;
  readonly outputMaxTokens?: number;
  readonly referenceImageUrls?: readonly string[];
  readonly referenceImageInline?: readonly ReferenceImageInline[];
  readonly referenceVideoUrls?: readonly string[];
  readonly upstreamLog?: UpstreamRequestLogSink;
}): Promise<
  { readonly ok: true; readonly text: string } | { readonly ok: false; readonly error: string }
> {
  const service = new CloudflareAiInterfaceService(params.env);
  const iface = await service.resolveOrgInterface({
    organizationId: params.organizationId,
    interfaceId: params.candidate.interfaceId,
  });

  if (!iface) {
    return { ok: false, error: "Could not resolve AI interface" };
  }

  const inferenceModelId = await resolveOrgModelInferenceModelId({
    db: params.db,
    organizationId: params.organizationId,
    interfaceId: params.candidate.interfaceId,
    canonicalId: params.canonicalId,
    instanceId: params.candidate.instanceId,
    channelKind: params.candidate.channelKind,
    upstreamModelId: params.candidate.providerModelId,
  });

  if (!inferenceModelId) {
    return {
      ok: false,
      error: "Upstream model id is not configured on this AI interface",
    };
  }

  const result = await executeAiInterfaceSync({
    resolved: withSelectedModel(iface, inferenceModelId),
    inputs: {
      prompt: params.effectivePrompt,
      ...(params.referenceImageUrls && params.referenceImageUrls.length > 0
        ? { referenceImageUrls: params.referenceImageUrls }
        : {}),
      ...(params.referenceImageInline && params.referenceImageInline.length > 0
        ? { referenceImageInline: params.referenceImageInline }
        : {}),
      ...(params.referenceVideoUrls && params.referenceVideoUrls.length > 0
        ? { referenceVideoUrls: params.referenceVideoUrls }
        : {}),
    },
    bodyExtensions: params.outputMaxTokens
      ? { max_tokens: params.outputMaxTokens }
      : undefined,
    upstreamLog: params.upstreamLog,
  });

  if (result.status !== "completed" || !result.outputs) {
    return { ok: false, error: result.error ?? "Generation failed" };
  }

  const text = result.outputs.text;
  if (typeof text !== "string" || text.trim().length === 0) {
    return { ok: false, error: "Model returned empty text" };
  }

  return { ok: true, text };
}

export async function executeTextModel(params: {
  readonly env: Bindings;
  readonly db: Database;
  readonly organizationId: string;
  readonly canonicalId: string;
  readonly interfaceId: string;
  readonly effectivePrompt: string;
  readonly outputMaxTokens?: number;
  readonly referenceImageUrls?: readonly string[];
  readonly referenceImageInline?: readonly ReferenceImageInline[];
  readonly referenceVideoUrls?: readonly string[];
  readonly upstreamLog?: UpstreamRequestLogSink;
}): Promise<ExecuteTextModelResult> {
  const [candidate, options] = await Promise.all([
    resolveOrgModelInterfaceCandidate(
      params.db,
      params.organizationId,
      params.canonicalId,
      params.interfaceId
    ),
    listOrgTextModelOptions(params.db, params.organizationId),
  ]);

  if (!candidate) {
    return {
      ok: false,
      error: `Model "${params.canonicalId}" is not available on this AI interface.`,
    };
  }

  const modelOption = options.find(
    (entry) =>
      entry.interfaceId === params.interfaceId &&
      entry.instanceId === params.candidate.instanceId
  );

  const result = await executeTextModelCandidate({
    env: params.env,
    db: params.db,
    organizationId: params.organizationId,
    canonicalId: params.canonicalId,
    candidate,
    effectivePrompt: params.effectivePrompt,
    outputMaxTokens: params.outputMaxTokens,
    referenceImageUrls: params.referenceImageUrls,
    referenceImageInline: params.referenceImageInline,
    referenceVideoUrls: params.referenceVideoUrls,
    upstreamLog: params.upstreamLog,
  });

  if (result.ok) {
    return {
      ok: true,
      text: result.text,
      interfaceId: candidate.interfaceId,
      interfaceName: candidate.interfaceName,
    };
  }

  const modelDisplayLabel = modelOption?.displayName ?? params.canonicalId;

  const failure = buildTextModelFailureCardParts({
    failedInterfaceName: candidate.interfaceName,
    channelKind: candidate.channelKind,
    modelDisplayLabel,
    upstreamError: result.error,
  });

  const invocationError = buildTextModelInvocationErrorFromFailure({
    upstreamError: result.error,
  });

  return {
    ok: false,
    error: failure.detail ?? failure.summary,
    invocationError,
  };
}
