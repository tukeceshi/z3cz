import {
  buildTextModelDisplayLabel,
  buildTextModelFailureCardParts,
  buildTextModelInvocationErrorFromFailure,
  isTransientTextModelUpstreamError,
  withSelectedModel,
  type ReferenceImageInline,
  type ResolvedOrgAiInterface,
} from "@dafthunk/types";
import {
  artifactSupportsChatStream,
  iterateAiInterfaceChatStream,
  type AiInterfaceStreamEvent,
} from "@dafthunk/runtime/ai-interface/execute-stream";

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

export interface PreparedTextModelStream {
  readonly candidate: TextModelInterfaceCandidate;
  readonly resolved: ResolvedOrgAiInterface;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly bodyExtensions?: Readonly<Record<string, unknown>>;
}

export async function prepareTextModelStream(params: {
  readonly env: Bindings;
  readonly db: Database;
  readonly organizationId: string;
  readonly canonicalId: string;
  readonly effectivePrompt: string;
  readonly outputMaxTokens?: number;
  readonly referenceImageUrls?: readonly string[];
  readonly referenceImageInline?: readonly ReferenceImageInline[];
  readonly referenceVideoUrls?: readonly string[];
}): Promise<
  | { readonly ok: true; readonly prepared: PreparedTextModelStream }
  | { readonly ok: false; readonly error: string; readonly invocationError?: string }
> {
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
  const service = new CloudflareAiInterfaceService(params.env);
  const iface = await service.resolveOrgInterface({
    organizationId: params.organizationId,
    interfaceId: candidate.interfaceId,
  });

  if (!iface) {
    return { ok: false, error: "Could not resolve AI interface" };
  }

  if (!artifactSupportsChatStream(iface.artifact)) {
    return {
      ok: false,
      error: "Streaming is not supported for this AI interface",
    };
  }

  const catalogProviderModelId = options.find(
    (entry) => entry.canonicalId === params.canonicalId
  )?.providerModelId;

  if (!catalogProviderModelId) {
    return { ok: false, error: "Model is not available for this organization" };
  }

  const inferenceModelId = await resolveVolcanoInferenceModelIdAfterEnsure({
    db: params.db,
    organizationId: params.organizationId,
    interfaceId: candidate.interfaceId,
    canonicalId: params.canonicalId,
    catalogProviderModelId,
  });

  return {
    ok: true,
    prepared: {
      candidate,
      resolved: withSelectedModel(iface, inferenceModelId),
      inputs: {
        prompt: params.effectivePrompt,
        ...(params.referenceImageUrls && params.referenceImageUrls.length > 0
          ? { referenceImageUrls: params.referenceImageUrls }
          : {}),
        ...(params.referenceImageInline &&
        params.referenceImageInline.length > 0
          ? { referenceImageInline: params.referenceImageInline }
          : {}),
        ...(params.referenceVideoUrls && params.referenceVideoUrls.length > 0
          ? { referenceVideoUrls: params.referenceVideoUrls }
          : {}),
      },
      bodyExtensions: params.outputMaxTokens
        ? { max_tokens: params.outputMaxTokens }
        : undefined,
    },
  };
}

export async function* streamPreparedTextModel(params: {
  readonly prepared: PreparedTextModelStream;
  readonly signal?: AbortSignal;
}): AsyncGenerator<AiInterfaceStreamEvent> {
  yield* iterateAiInterfaceChatStream({
    resolved: params.prepared.resolved,
    inputs: params.prepared.inputs,
    bodyExtensions: params.prepared.bodyExtensions,
    signal: params.signal,
  });
}

export async function handleTextModelStreamFailure(params: {
  readonly db: Database;
  readonly organizationId: string;
  readonly canonicalId: string;
  readonly candidate: TextModelInterfaceCandidate;
  readonly upstreamError: string;
  readonly displayName: string;
  readonly modality: "text" | "image" | "video" | "audio";
  readonly nextCandidate?: TextModelInterfaceCandidate;
}): Promise<{ readonly error: string; readonly invocationError: string }> {
  const transient = isTransientTextModelUpstreamError(params.upstreamError);
  if (!transient) {
    await disableTextModelOnInterface(
      params.db,
      params.organizationId,
      params.candidate.interfaceId,
      params.canonicalId
    );
  }

  const next = transient ? undefined : params.nextCandidate;
  const modelDisplayLabel = buildTextModelDisplayLabel({
    displayName: params.displayName,
    modality: params.modality,
  });

  const failure = buildTextModelFailureCardParts({
    failedInterfaceName: params.candidate.interfaceName,
    channelKind: params.candidate.channelKind,
    modelDisplayLabel,
    upstreamError: params.upstreamError,
    nextInterfaceName: next?.interfaceName,
    nextChannelKind: next?.channelKind,
    disabledInterface: !transient,
  });

  return {
    error: failure.detail ?? failure.summary,
    invocationError: buildTextModelInvocationErrorFromFailure({
      upstreamError: params.upstreamError,
    }),
  };
}
