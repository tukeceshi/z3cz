import {
  buildTextModelDisplayLabel,
  buildTextModelFailureCardParts,
  buildTextModelInvocationErrorFromFailure,
  isTransientTextModelUpstreamError,
  withSelectedModel,
  type ReferenceImageInline,
} from "@dafthunk/types";
import { executeAiInterfaceSync } from "@dafthunk/runtime/ai-interface/execute-sync";

import type { Bindings } from "../context";
import type { Database } from "../db";
import { resolveVolcanoInferenceModelIdAfterEnsure } from "../integrations/volcengine/resolve-inference-model-id";
import { CloudflareAiInterfaceService } from "../runtime/cloudflare-ai-interface-service";
import { disableTextModelOnInterface } from "./disable-text-model-on-interface";
import {
  listOrgTextModelOptions,
  listTextModelInterfaceCandidates,
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

  const catalogProviderModelId = (
    await listOrgTextModelOptions(params.db, params.organizationId)
  ).find((entry) => entry.canonicalId === params.canonicalId)?.providerModelId;

  if (!catalogProviderModelId) {
    return { ok: false, error: "Model is not available for this organization" };
  }

  const inferenceModelId = await resolveVolcanoInferenceModelIdAfterEnsure({
    db: params.db,
    organizationId: params.organizationId,
    interfaceId: params.candidate.interfaceId,
    canonicalId: params.canonicalId,
    catalogProviderModelId,
  });

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
  });

  if (result.status === "failed") {
    return { ok: false, error: result.error ?? "AI interface request failed" };
  }

  const text =
    result.outputs?.text ?? result.outputs?.content ?? result.outputs?.result;
  if (typeof text !== "string") {
    return { ok: false, error: "AI interface returned no text" };
  }

  return { ok: true, text };
}

export async function executeTextModel(params: {
  readonly env: Bindings;
  readonly db: Database;
  readonly organizationId: string;
  readonly canonicalId: string;
  readonly effectivePrompt: string;
  readonly outputMaxTokens?: number;
  readonly referenceImageUrls?: readonly string[];
  readonly referenceImageInline?: readonly ReferenceImageInline[];
  readonly referenceVideoUrls?: readonly string[];
}): Promise<ExecuteTextModelResult> {
  const [candidates, options] = await Promise.all([
    listTextModelInterfaceCandidates(
      params.db,
      params.organizationId,
      params.canonicalId
    ),
    listOrgTextModelOptions(params.db, params.organizationId),
  ]);

  if (candidates.length === 0) {
    return {
      ok: false,
      error: `Model "${params.canonicalId}" is not available for this organization.`,
    };
  }

  const candidate = candidates[0]!;
  const modelOption = options.find(
    (entry) => entry.canonicalId === params.canonicalId
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
  });

  if (result.ok) {
    return {
      ok: true,
      text: result.text,
      interfaceId: candidate.interfaceId,
      interfaceName: candidate.interfaceName,
    };
  }

  const transient = isTransientTextModelUpstreamError(result.error);
  if (!transient) {
    await disableTextModelOnInterface(
      params.db,
      params.organizationId,
      candidate.interfaceId,
      params.canonicalId
    );
  }

  const next = transient ? undefined : candidates[1];
  const modelDisplayLabel = modelOption
    ? buildTextModelDisplayLabel({
        displayName: modelOption.displayName,
        modality: modelOption.modality,
      })
    : params.canonicalId;

  const failure = buildTextModelFailureCardParts({
    failedInterfaceName: candidate.interfaceName,
    channelKind: candidate.channelKind,
    modelDisplayLabel,
    upstreamError: result.error,
    nextInterfaceName: next?.interfaceName,
    nextChannelKind: next?.channelKind,
    disabledInterface: !transient,
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
