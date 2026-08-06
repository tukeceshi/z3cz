import {
  createEphemeralMediaExpiresAt,
  normalizeAudioModelParameterRules,
  type AudioModelParameterRules,
  type EphemeralMediaReference,
  type MediaReference,
  type ObjectReference,
  type UpstreamParamProfileField,
} from "@dafthunk/types";

import type { ObjectStore } from "../node-types";
import type {
  CloudImageUploadTarget,
  VolcanoImageStorageMode,
} from "./execute-volcano-image";
import {
  fetchWithUpstreamLog,
  type UpstreamRequestLogSink,
} from "./upstream-request-log";

const MINIMAX_SPEECH_MIME_TYPE = "audio/mpeg" as const;
const REQUEST_TIMEOUT_MS = 120_000;
const EPHEMERAL_TTL_MS = 3_600_000;

export interface MinimaxAudioGenerationResult {
  readonly status: "completed" | "failed";
  readonly audios?: readonly MediaReference[];
  readonly error?: string;
  readonly storageMode?: VolcanoImageStorageMode;
}

interface MinimaxT2aResponse {
  readonly data?: {
    readonly audio?: string;
    readonly status?: number;
  };
  readonly base_resp?: {
    readonly status_code?: number;
    readonly status_msg?: string;
  };
}

function buildVoiceSetting(
  generationFields: readonly UpstreamParamProfileField[],
  params?: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  const voiceSetting: Record<string, unknown> = {};

  for (const field of generationFields) {
    if (!field.apiName.startsWith("voice_setting.")) {
      continue;
    }

    const leaf = field.apiName.slice("voice_setting.".length);
    const raw = params?.[field.name];
    const value =
      raw === undefined || raw === null || raw === ""
        ? field.default
        : raw;

    if (value === undefined || value === null || value === "") {
      continue;
    }

    voiceSetting[leaf] = value;
  }

  return voiceSetting;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function hexToUint8Array(hex: string): Uint8Array {
  const normalized = hex.trim();
  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < normalized.length; index += 2) {
    bytes[index / 2] = Number.parseInt(normalized.slice(index, index + 2), 16);
  }
  return bytes;
}

async function requestMinimaxSpeech(params: {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly providerModelId: string;
  readonly text: string;
  readonly parameterRules: AudioModelParameterRules;
  readonly generationParams?: Readonly<Record<string, unknown>>;
  readonly upstreamLog?: UpstreamRequestLogSink;
}): Promise<
  | { readonly ok: true; readonly audio: Uint8Array; readonly mimeType: string }
  | { readonly ok: false; readonly error: string }
> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const voiceSetting = buildVoiceSetting(
      params.parameterRules.generationFields,
      params.generationParams
    );

    const response = await fetchWithUpstreamLog(
      `${normalizeBaseUrl(params.baseUrl)}/v1/t2a_v2`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${params.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: params.providerModelId,
          text: params.text,
          stream: false,
          voice_setting: voiceSetting,
          audio_setting: {
            format: "mp3",
            sample_rate: 32000,
          },
        }),
        signal: controller.signal,
      },
      params.upstreamLog
    );

    const parsed = (await response.json()) as MinimaxT2aResponse;
    const statusCode = parsed.base_resp?.status_code;

    if (!response.ok || (statusCode !== undefined && statusCode !== 0)) {
      return {
        ok: false,
        error:
          parsed.base_resp?.status_msg ??
          `MiniMax speech request failed (${response.status})`,
      };
    }

    const audioHex = parsed.data?.audio?.trim();
    if (!audioHex) {
      return {
        ok: false,
        error: "No audio data in MiniMax response",
      };
    }

    return {
      ok: true,
      audio: hexToUint8Array(audioHex),
      mimeType: MINIMAX_SPEECH_MIME_TYPE,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "MiniMax speech generation failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function executeMinimaxAudioGeneration(params: {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly providerModelId: string;
  readonly prompt: string;
  readonly parameterRules: AudioModelParameterRules;
  readonly generationParams?: Readonly<Record<string, unknown>>;
  readonly storageMode: VolcanoImageStorageMode;
  readonly objectStore?: ObjectStore;
  readonly organizationId: string;
  readonly workflowId?: string;
  readonly cloudUpload?: CloudImageUploadTarget;
  readonly upstreamLog?: UpstreamRequestLogSink;
}): Promise<MinimaxAudioGenerationResult> {
  const rules = normalizeAudioModelParameterRules(params.parameterRules);
  const trimmedPrompt = params.prompt.trim();

  if (!trimmedPrompt) {
    return { status: "failed", error: "Prompt is required" };
  }

  if (trimmedPrompt.length > rules.promptMaxChars) {
    return {
      status: "failed",
      error: `Prompt exceeds maximum length of ${rules.promptMaxChars} characters`,
    };
  }

  const speechResult = await requestMinimaxSpeech({
    apiKey: params.apiKey,
    baseUrl: params.baseUrl,
    providerModelId: params.providerModelId,
    text: trimmedPrompt,
    parameterRules: rules,
    generationParams: params.generationParams,
    upstreamLog: params.upstreamLog,
  });

  if (!speechResult.ok) {
    return { status: "failed", error: speechResult.error };
  }

  const { audio, mimeType } = speechResult;

  if (params.storageMode === "ephemeral") {
    if (!params.objectStore) {
      return {
        status: "failed",
        error: "Object store is not available for ephemeral audio storage",
      };
    }

    const url = await params.objectStore.writeAndPresign(
      audio,
      mimeType,
      params.organizationId,
      Math.floor(EPHEMERAL_TTL_MS / 1000)
    );

    const ephemeralAudio: EphemeralMediaReference = {
      kind: "ephemeral",
      url,
      mimeType,
      mediaId: crypto.randomUUID(),
      expiresAt: createEphemeralMediaExpiresAt(),
    };

    return {
      status: "completed",
      audios: [ephemeralAudio],
      storageMode: "ephemeral",
    };
  }

  if (!params.objectStore && !params.cloudUpload) {
    return {
      status: "failed",
      error: "Cloud storage is not available for persistence",
    };
  }

  const workflowId = params.workflowId?.trim() || "unknown";
  let audioReference: ObjectReference;

  if (params.cloudUpload) {
    audioReference = await params.cloudUpload.upload({
      workflowId,
      data: audio,
      mimeType,
      objectId: crypto.randomUUID(),
    });
  } else if (params.objectStore) {
    audioReference = await params.objectStore.writeObject(
      audio,
      mimeType,
      params.organizationId
    );
  } else {
    return {
      status: "failed",
      error: "Object store is not available",
    };
  }

  return {
    status: "completed",
    audios: [audioReference],
    storageMode: "cloud",
  };
}
