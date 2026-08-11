import type { AiModelModality } from "./ai-model-catalog";

export type PlatformAiModelChannelKind = "aggregate" | "api";

export const VOLCANO_AGGREGATE_PRESET_ID = "aggregate:volcano" as const;

export interface PlatformAiModelChannel {
  readonly canonicalId: string;
  readonly channel: PlatformAiModelChannelKind;
  readonly presetId: string;
  readonly upstreamModelId: string;
  readonly channelEnabled: boolean;
}

export interface PlatformAiModelChannelOption {
  readonly canonicalId: string;
  readonly displayName: string;
  readonly modality: AiModelModality;
  readonly channel: PlatformAiModelChannelKind;
  readonly presetId: string;
  readonly upstreamModelId: string;
  readonly brandIcon: string | null;
  readonly sortOrder: number;
}

export interface ListPlatformAiModelChannelsResponse {
  readonly channels: readonly PlatformAiModelChannelOption[];
}
