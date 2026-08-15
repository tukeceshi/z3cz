import {
  hasDisplayableWorkflowMedia,
  hasFailedResource,
  hasGeneratingResource,
  isDisplayableWorkflowMedia,
  isLocalMediaReference,
  type ImageGenerationRequestSnapshot,
} from "@dafthunk/types";

import {
  isGenerativePersistPhase,
  isGenerativeProgressBusyPhase,
  readGenerativeProgressPhase,
} from "./generative-progress-utils";

export interface GenerativeCardCoverRead<TMedia> {
  readonly coverMedia: readonly TMedia[];
  readonly isBusy: boolean;
  readonly hasCover: boolean;
}

/** True while the card should keep loading UI and hold layout. */
export function isGenerativeCardCoverBusy(
  metadata: Record<string, string> | undefined,
  isModalityGenerating: boolean
): boolean {
  if (isModalityGenerating) {
    return true;
  }
  const phase = readGenerativeProgressPhase(metadata);
  return isGenerativeProgressBusyPhase(phase);
}

export function shouldHoldUnreadyCardCover(params: {
  readonly metadata?: Record<string, string>;
  readonly isModalityGenerating: boolean;
  readonly selectedMedia?: readonly unknown[];
}): boolean {
  if (params.isModalityGenerating) {
    return true;
  }
  if (hasGeneratingResource(params.selectedMedia)) {
    return true;
  }
  const phase = readGenerativeProgressPhase(params.metadata);
  return isGenerativePersistPhase(phase) || phase === "queued" || phase === "generating";
}

export function readGenerativeCardCoverFromHistory<
  TItem extends { readonly id: string },
  TMedia,
>(
  history: {
    readonly items: readonly TItem[];
    readonly selectedId: string | null;
  },
  getMedia: (item: TItem) => readonly TMedia[],
  params: {
    readonly metadata?: Record<string, string>;
    readonly isModalityGenerating: boolean;
  }
): GenerativeCardCoverRead<TMedia> {
  const selected = readSelectedHistoryMedia(history, getMedia);
  const selectedFailed = hasFailedResource(selected ?? undefined);
  const isBusy =
    !selectedFailed &&
    (isGenerativeCardCoverBusy(params.metadata, params.isModalityGenerating) ||
      hasGeneratingResource(selected ?? undefined));
  const holdUnreadyCover =
    !selectedFailed &&
    shouldHoldUnreadyCardCover({
      metadata: params.metadata,
      isModalityGenerating: params.isModalityGenerating,
      selectedMedia: selected ?? undefined,
    });
  const coverMedia =
    readDisplayHistoryMedia(history, getMedia, { holdUnreadyCover }) ?? [];

  return {
    coverMedia,
    isBusy,
    hasCover: hasDisplayableWorkflowMedia(coverMedia),
  };
}

function isReadyCoverMedia(
  value: unknown,
  holdUnreadyCover: boolean
): boolean {
  if (isLocalMediaReference(value)) {
    return true;
  }
  if (!isDisplayableWorkflowMedia(value)) {
    return false;
  }
  return !holdUnreadyCover;
}

/**
 * Shared helpers for generative media history: one media per row.
 */
export function splitHistoryMediaRows<TMedia, TItem extends {
  readonly id: string;
  readonly createdAt: string;
}>(params: {
  readonly items: readonly TItem[];
  readonly getMedia: (item: TItem) => readonly TMedia[];
  readonly withMedia: (item: TItem, media: readonly TMedia[]) => TItem;
}): TItem[] {
  const out: TItem[] = [];
  for (const item of params.items) {
    const media = params.getMedia(item);
    if (media.length <= 1) {
      out.push(item);
      continue;
    }
    for (let index = 0; index < media.length; index += 1) {
      out.push(
        params.withMedia(
          {
            ...item,
            id: index === 0 ? item.id : `${item.id}-${index}`,
          } as TItem,
          [media[index]!]
        )
      );
    }
  }
  return out;
}

export function readSelectedHistoryMedia<TItem extends { readonly id: string }, TMedia>(
  history: {
    readonly items: readonly TItem[];
    readonly selectedId: string | null;
  },
  getMedia: (item: TItem) => readonly TMedia[]
): readonly TMedia[] | null {
  if (!history.selectedId) {
    return null;
  }
  const selected = history.items.find((item) => item.id === history.selectedId);
  if (!selected) {
    return null;
  }
  return getMedia(selected);
}

/** Card cover: keep the last ready media while the selected row is still generating. */
export function readDisplayHistoryMedia<TItem extends { readonly id: string }, TMedia>(
  history: {
    readonly items: readonly TItem[];
    readonly selectedId: string | null;
  },
  getMedia: (item: TItem) => readonly TMedia[],
  options?: { readonly holdUnreadyCover?: boolean }
): readonly TMedia[] | null {
  const selected = readSelectedHistoryMedia(history, getMedia);
  if (selected === null) {
    return null;
  }

  if (hasFailedResource(selected)) {
    return selected;
  }

  const holdUnreadyCover = options?.holdUnreadyCover === true;
  const selectedReady = selected.filter((entry) =>
    isReadyCoverMedia(entry, holdUnreadyCover)
  );
  if (selectedReady.length > 0) {
    return selectedReady;
  }

  const shouldHold =
    hasGeneratingResource(selected) ||
    (holdUnreadyCover && !selected.some(isLocalMediaReference));
  if (!shouldHold) {
    return selected;
  }

  for (const item of history.items) {
    if (item.id === history.selectedId) {
      continue;
    }
    const media = getMedia(item);
    const ready = media.filter((entry) => isReadyCoverMedia(entry, false));
    if (ready.length > 0) {
      return ready;
    }
  }

  if (hasGeneratingResource(selected)) {
    return selected;
  }
  return [];
}

export function formatHistoryCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function resolveHistoryModelLabel(item: {
  readonly modelDisplayName?: string;
  readonly platformModelId?: string;
  readonly providerModelId?: string;
}): string | null {
  const label =
    item.modelDisplayName?.trim() ||
    item.platformModelId?.trim() ||
    item.providerModelId?.trim();
  return label || null;
}

/** Console model display name snapshot from history (no ID fallback). */
export function readHistoryModelDisplayName(
  item: { readonly modelDisplayName?: string } | null | undefined
): string | null {
  const label = item?.modelDisplayName?.trim();
  return label || null;
}

/** Resolution / size label from history params (e.g. 1080p). */
export function readHistoryResolutionLabel(
  params: Readonly<Record<string, unknown>> | undefined
): string | null {
  if (!params) {
    return null;
  }
  const size = params.size ?? params.resolution;
  if (
    typeof size === "string" &&
    size.trim() &&
    size !== "auto" &&
    size !== "adaptive"
  ) {
    return size.trim();
  }
  return null;
}

/** Compact param chips for history detail (order stable). */
export function collectHistoryParamParts(
  params: Readonly<Record<string, unknown>> | undefined
): string[] {
  if (!params) {
    return [];
  }
  const parts: string[] = [];
  const resolution = readHistoryResolutionLabel(params);
  if (resolution) {
    parts.push(resolution);
  }
  const ratio = params.ratio ?? params.aspect_ratio;
  if (
    typeof ratio === "string" &&
    ratio.trim() &&
    ratio !== "auto" &&
    ratio !== "adaptive"
  ) {
    parts.push(ratio.trim());
  }
  const duration = params.duration ?? params.duration_seconds;
  if (typeof duration === "number" && Number.isFinite(duration)) {
    parts.push(`${duration}s`);
  } else if (typeof duration === "string" && duration.trim()) {
    parts.push(duration.trim());
  }
  const count = params.generate_count ?? params.batch_count;
  if (typeof count === "number" && count > 1) {
    parts.push(`×${count}`);
  }
  if (params.watermark === true) {
    parts.push("watermark");
  }
  return parts;
}

/** Prefer UI params; fall back to outbound request snapshot for history chips. */
export function collectImageHistoryParamParts(item: {
  readonly params?: Readonly<Record<string, unknown>>;
  readonly requestSnapshot?: ImageGenerationRequestSnapshot;
}): string[] {
  const fromParams = collectHistoryParamParts(item.params);
  if (fromParams.length > 0) {
    return fromParams;
  }

  const snapshot = item.requestSnapshot;
  if (!snapshot) {
    return [];
  }

  const parts: string[] = [];
  if (snapshot.size) {
    parts.push(snapshot.size);
  }
  if (typeof snapshot.maxImages === "number" && snapshot.maxImages > 1) {
    parts.push(`×${snapshot.maxImages}`);
  }
  if (snapshot.watermark === true) {
    parts.push("watermark");
  }
  return parts;
}
