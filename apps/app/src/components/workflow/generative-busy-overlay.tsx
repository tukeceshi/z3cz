import LoaderIcon from "lucide-react/icons/loader-circle";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import {
  generativeAudioProgressButtonKey,
  generativeCardProgressKey,
  generativeProgressButtonKey,
  generativeVideoProgressButtonKey,
} from "@/hooks/use-generative-cloud-job";
import { cn } from "@/utils/utils";

import { isAiAudioGenerating } from "./ai-audio-node-utils";
import { isAiImageGenerating } from "./ai-image-node-utils";
import { isAiVideoGenerating } from "./ai-video-node-utils";
import { cancelGenerativeGenerationForNode } from "./generative-generation-cancel";
import { GENERATIVE_CARD_STATE_LABEL_CLASS } from "./generative-card-styles";
import {
  formatGenerativeBusyOverlayLabel,
  isGenerativePhaseCancellable,
  isGenerativeProgressBusyPhase,
  readGenerativeProgressPhase,
  type GenerativeProgressPhase,
} from "./generative-progress-utils";
import { useWorkflow } from "./workflow-context";

export type GenerativeBusyModality = "image" | "video" | "audio";

export interface GenerativeBusyOverlayProps {
  readonly visible: boolean;
  readonly modality: GenerativeBusyModality | null;
  readonly metadata: Record<string, string> | undefined;
  readonly nodeId?: string;
  readonly uploading?: boolean;
  readonly roundedClass?: string;
  readonly className?: string;
}

function readModalityBusy(
  modality: GenerativeBusyModality,
  metadata: Record<string, string> | undefined
): boolean {
  const progressPhase = readGenerativeProgressPhase(metadata);
  if (modality === "image") {
    return isAiImageGenerating(metadata) || progressPhase !== undefined;
  }
  if (modality === "video") {
    return (
      isAiVideoGenerating(metadata) ||
      isGenerativeProgressBusyPhase(progressPhase)
    );
  }
  return isAiAudioGenerating(metadata) || progressPhase !== undefined;
}

function resolveBusyOverlayLabel(params: {
  readonly modality: GenerativeBusyModality;
  readonly metadata: Record<string, string> | undefined;
  readonly progressNowMs: number;
  readonly uploading: boolean;
  readonly t: (
    key: string,
    values?: Record<string, string | number>
  ) => string;
}): string | null {
  const progressPhase = readGenerativeProgressPhase(params.metadata);
  const modalityBusy = readModalityBusy(params.modality, params.metadata);

  if (!modalityBusy && !progressPhase && !params.uploading) {
    return null;
  }

  if (!modalityBusy && !progressPhase && params.uploading) {
    return params.t(generativeCardProgressKey("uploading", params.modality));
  }

  const phase: GenerativeProgressPhase = progressPhase ?? "generating";
  const i18nPrefix =
    params.modality === "image"
      ? "workflow.aiImagePanel"
      : params.modality === "video"
        ? "workflow.aiVideoPanel"
        : "workflow.aiAudioPanel";
  const progressButtonKey =
    params.modality === "image"
      ? generativeProgressButtonKey
      : params.modality === "video"
        ? generativeVideoProgressButtonKey
        : generativeAudioProgressButtonKey;

  return formatGenerativeBusyOverlayLabel({
    phase,
    progressButtonKey,
    i18nPrefix,
    metadata: params.metadata,
    progressNowMs: params.progressNowMs,
    t: params.t,
  });
}

export function GenerativeBusyOverlay({
  visible,
  modality,
  metadata,
  nodeId,
  uploading = false,
  roundedClass,
  className,
}: GenerativeBusyOverlayProps) {
  const { t } = useTranslation();
  const { organization } = useAuth();
  const { updateNodeData } = useWorkflow();
  const orgId = organization?.id;

  const progressPhase = readGenerativeProgressPhase(metadata);
  const modalityBusy =
    modality != null ? readModalityBusy(modality, metadata) : false;
  const showOverlay = visible && (modalityBusy || uploading || progressPhase != null);

  const [progressNowMs, setProgressNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!showOverlay || !progressPhase) {
      return;
    }
    setProgressNowMs(Date.now());
    const timerId = window.setInterval(() => {
      setProgressNowMs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timerId);
    };
  }, [progressPhase, showOverlay]);

  const label = useMemo(() => {
    if (!modality) {
      return null;
    }
    return resolveBusyOverlayLabel({
      modality,
      metadata,
      progressNowMs,
      uploading,
      t,
    });
  }, [metadata, modality, progressNowMs, t, uploading]);

  const overlayProgressPhase =
    progressPhase ??
    (modalityBusy && modality !== "audio" ? ("generating" as const) : null);
  const showCancel =
    modality === "video" &&
    showOverlay &&
    Boolean(nodeId) &&
    progressPhase !== "cancelling" &&
    isGenerativePhaseCancellable(overlayProgressPhase);

  const handleCancel = useCallback(() => {
    if (!showCancel || !nodeId) {
      return;
    }
    void cancelGenerativeGenerationForNode({
      nodeId,
      orgId,
      metadata,
      modality: "video",
      updateNodeData,
    });
  }, [metadata, nodeId, orgId, showCancel, updateNodeData]);

  if (!showOverlay) {
    return null;
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-card/70 backdrop-blur-[1px]",
        roundedClass,
        className
      )}
    >
      <LoaderIcon className="h-5 w-5 animate-spin text-yellow-500" aria-hidden />
      {showCancel ? (
        <button
          type="button"
          className={cn(
            "pointer-events-auto min-h-8 rounded-md px-4 py-2 text-sm font-medium",
            "bg-red-600 text-white hover:bg-red-500",
            "dark:bg-red-500 dark:hover:bg-red-400"
          )}
          onClick={(event) => {
            event.stopPropagation();
            handleCancel();
          }}
        >
          {t("workflow.generativeCancel.action")}
        </button>
      ) : null}
      {label ? (
        <p className={cn("max-w-[90%] px-3 text-center", GENERATIVE_CARD_STATE_LABEL_CLASS)}>
          {label}
        </p>
      ) : null}
    </div>
  );
}

export interface WorkflowNodeGenerativeBusyOverlayProps {
  readonly visible: boolean;
  readonly isAiImageNode: boolean;
  readonly isAiVideoNode: boolean;
  readonly isAiAudioNode: boolean;
  readonly isAiImageBusy: boolean;
  readonly isAiVideoBusy: boolean;
  readonly isAiAudioBusy: boolean;
  readonly metadata: Record<string, string> | undefined;
  readonly nodeId: string;
  readonly roundedClass?: string;
}

/** Canvas workflow-node overlay — preserves existing label/cancel behavior. */
export function WorkflowNodeGenerativeBusyOverlay({
  visible,
  isAiImageNode,
  isAiVideoNode,
  isAiAudioNode,
  isAiImageBusy,
  isAiVideoBusy,
  isAiAudioBusy,
  metadata,
  nodeId,
  roundedClass,
}: WorkflowNodeGenerativeBusyOverlayProps) {
  const { t } = useTranslation();
  const { organization } = useAuth();
  const { updateNodeData } = useWorkflow();
  const orgId = organization?.id;

  const progressPhase = readGenerativeProgressPhase(metadata);

  const [progressNowMs, setProgressNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!visible || !progressPhase) {
      return;
    }
    setProgressNowMs(Date.now());
    const timerId = window.setInterval(() => {
      setProgressNowMs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timerId);
    };
  }, [progressPhase, visible]);

  const label = useMemo(() => {
    if (!isAiImageNode && !isAiVideoNode && !isAiAudioNode) {
      return null;
    }
    if (!isAiImageBusy && !isAiVideoBusy && !isAiAudioBusy && !progressPhase) {
      return null;
    }

    const phase = progressPhase ?? "generating";
    if (isAiImageNode) {
      return formatGenerativeBusyOverlayLabel({
        phase,
        progressButtonKey: generativeProgressButtonKey,
        i18nPrefix: "workflow.aiImagePanel",
        metadata,
        progressNowMs,
        t,
      });
    }
    if (isAiVideoNode) {
      return formatGenerativeBusyOverlayLabel({
        phase,
        progressButtonKey: generativeVideoProgressButtonKey,
        i18nPrefix: "workflow.aiVideoPanel",
        metadata,
        progressNowMs,
        t,
      });
    }
    return formatGenerativeBusyOverlayLabel({
      phase,
      progressButtonKey: generativeAudioProgressButtonKey,
      i18nPrefix: "workflow.aiAudioPanel",
      metadata,
      progressNowMs,
      t,
    });
  }, [
    isAiAudioNode,
    isAiAudioBusy,
    isAiImageBusy,
    isAiImageNode,
    isAiVideoBusy,
    isAiVideoNode,
    metadata,
    progressNowMs,
    progressPhase,
    t,
  ]);

  const overlayProgressPhase =
    progressPhase ??
    (isAiImageBusy || isAiVideoBusy ? ("generating" as const) : null);
  const showCancel =
    isAiVideoNode &&
    visible &&
    progressPhase !== "cancelling" &&
    isGenerativePhaseCancellable(overlayProgressPhase);

  const handleCancel = useCallback(() => {
    if (!showCancel) {
      return;
    }
    void cancelGenerativeGenerationForNode({
      nodeId,
      orgId,
      metadata,
      modality: "video",
      updateNodeData,
    });
  }, [metadata, nodeId, orgId, showCancel, updateNodeData]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-card/70 backdrop-blur-[1px]",
        roundedClass
      )}
    >
      <LoaderIcon className="h-5 w-5 animate-spin text-yellow-500" aria-hidden />
      {showCancel ? (
        <button
          type="button"
          className={cn(
            "nodrag min-h-8 rounded-md px-4 py-2 text-sm font-medium",
            "bg-red-600 text-white hover:bg-red-500",
            "dark:bg-red-500 dark:hover:bg-red-400"
          )}
          onClick={(event) => {
            event.stopPropagation();
            handleCancel();
          }}
        >
          {t("workflow.generativeCancel.action")}
        </button>
      ) : null}
      {label ? (
        <p className={cn("max-w-[90%] px-3 text-center", GENERATIVE_CARD_STATE_LABEL_CLASS)}>
          {label}
        </p>
      ) : null}
    </div>
  );
}
