import type {
  AudioModelParameterRules,
  UpstreamParamProfileField,
} from "@dafthunk/types";
import {
  fetchWithUpstreamLog,
  type UpstreamRequestLogSink,
} from "@dafthunk/runtime/ai-interface/upstream-request-log";

const MINIMAX_SPEECH_MIME_TYPE = "audio/mpeg" as const;
const REQUEST_TIMEOUT_MS = 120_000;

export interface ExecuteMinimaxSpeechParams {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly providerModelId: string;
  readonly text: string;
  readonly parameterRules: AudioModelParameterRules;
  readonly generationParams?: Readonly<Record<string, unknown>>;
  readonly upstreamLog?: UpstreamRequestLogSink;
}

export interface ExecuteMinimaxSpeechResult {
  readonly status: "completed" | "failed";
  readonly audio?: Buffer;
  readonly mimeType?: string;
  readonly error?: string;
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

export async function executeMinimaxSpeech(
  params: ExecuteMinimaxSpeechParams
): Promise<ExecuteMinimaxSpeechResult> {
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
        status: "failed",
        error:
          parsed.base_resp?.status_msg ??
          `MiniMax speech request failed (${response.status})`,
      };
    }

    const audioHex = parsed.data?.audio?.trim();
    if (!audioHex) {
      return {
        status: "failed",
        error: "No audio data in MiniMax response",
      };
    }

    return {
      status: "completed",
      audio: Buffer.from(audioHex, "hex"),
      mimeType: MINIMAX_SPEECH_MIME_TYPE,
    };
  } catch (error) {
    return {
      status: "failed",
      error:
        error instanceof Error ? error.message : "MiniMax speech generation failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}
