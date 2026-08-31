import {
  isVolcanoMediaKitVideoTrimEnabled,
  SEEDANCE_2_5_VIDEO_EDIT_MIN_SEC,
  type VideoTrimRangeSec,
} from "@dafthunk/types";
import PauseIcon from "lucide-react/icons/pause";
import PlayIcon from "lucide-react/icons/play";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useOrgUrl } from "@/hooks/use-org-url";
import { useOrgVolcanoMediaKitConfig } from "@/hooks/use-volcano-mediakit-config";

import { useAiVideoRetakeDraft } from "./ai-video-retake-node-utils";
import { VideoTrimLocalTrimHintIcon } from "./video-trim-local-trim-hint-icon";
import { VideoTrimRuler } from "./video-trim-ruler";
import { VideoTrimTimeFields } from "./video-trim-time-fields";
import {
  VIDEO_TRIM_PANEL_ACTION_BUTTON_CLASS,
  VIDEO_TRIM_PANEL_FOOTER_ACTIONS_CLASS,
  VIDEO_TRIM_PANEL_FOOTER_CENTER_CLASS,
  VIDEO_TRIM_PANEL_FOOTER_CLASS,
  VIDEO_TRIM_PANEL_FOOTER_LEFT_CLASS,
  VIDEO_TRIM_PANEL_RULER_ROW_CLASS,
  VIDEO_TRIM_PANEL_SHELL_CLASS,
} from "./video-trim-panel-styles";
import type { WorkflowNodeType } from "./workflow-types";

export interface AiVideoRetakeTrimPanelProps {
  readonly nodeId: string;
  readonly data: WorkflowNodeType;
}

export function AiVideoRetakeTrimPanel({
  nodeId,
  data,
}: AiVideoRetakeTrimPanelProps) {
  const { t } = useTranslation();
  const { organization } = useAuth();
  const orgId = organization?.id;
  const { getOrgUrl } = useOrgUrl();
  const {
    draft,
    isRetakePanel,
    patchDraft,
    setDraftRange,
    commitDraftRange,
    setPlaybackPaused,
  } = useAiVideoRetakeDraft(nodeId, data);
  const { interfaceId: mediaKitInterfaceId, config: mediaKitConfig } =
    useOrgVolcanoMediaKitConfig(orgId);

  const [highQualityHintOpen, setHighQualityHintOpen] = useState(false);
  const [localTrimHintOpen, setLocalTrimHintOpen] = useState(false);
  const highQualityDefaultAppliedRef = useRef(false);

  const mediaKitTrimAvailable = Boolean(
    mediaKitConfig &&
      isVolcanoMediaKitVideoTrimEnabled({
        enabled: mediaKitConfig.active,
        videoEnhance: mediaKitConfig.snapshot.videoEnhance,
        videoTrim: mediaKitConfig.snapshot.videoTrim,
        subtitleErase: mediaKitConfig.snapshot.subtitleErase,
      }) &&
      mediaKitConfig.hasApiKey
  );

  const retakeReady =
    draft.loadPhase === "ready" &&
    draft.videoDurationSec !== null &&
    draft.videoDurationSec > 0;

  useEffect(() => {
    if (!isRetakePanel) {
      highQualityDefaultAppliedRef.current = false;
      return;
    }

    if (!retakeReady || highQualityDefaultAppliedRef.current) {
      return;
    }

    highQualityDefaultAppliedRef.current = true;

    if (mediaKitTrimAvailable) {
      patchDraft({ highQuality: true });
      return;
    }

    setLocalTrimHintOpen(true);
  }, [isRetakePanel, mediaKitTrimAvailable, patchDraft, retakeReady]);

  const handleDraftRangeChange = useCallback(
    (range: VideoTrimRangeSec) => {
      setDraftRange(range);
    },
    [setDraftRange]
  );

  const handleRangeCommit = useCallback(
    (range: VideoTrimRangeSec) => {
      commitDraftRange(range);
    },
    [commitDraftRange]
  );

  if (!isRetakePanel) {
    return null;
  }

  const ready = retakeReady;

  const interfacesUrl = mediaKitInterfaceId
    ? getOrgUrl(`/ai-interfaces/${mediaKitInterfaceId}`)
    : getOrgUrl("/ai-interfaces");

  const handleHighQualityToggle = (checked: boolean) => {
    if (checked && !mediaKitTrimAvailable) {
      setHighQualityHintOpen(true);
      return;
    }
    patchDraft({ highQuality: checked });
  };

  return (
    <div className={VIDEO_TRIM_PANEL_SHELL_CLASS}>
      <div className={VIDEO_TRIM_PANEL_RULER_ROW_CLASS}>
        {ready ? (
          <VideoTrimRuler
            videoDurationSec={draft.videoDurationSec ?? 0}
            range={draft.draftRange}
            minSelectionSec={SEEDANCE_2_5_VIDEO_EDIT_MIN_SEC}
            onRangeChange={handleDraftRangeChange}
            onRangeCommit={handleRangeCommit}
          />
        ) : (
          <div className="h-9 min-w-0 flex-1 animate-pulse rounded-md bg-neutral-200/80 dark:bg-neutral-700/60" />
        )}
      </div>

      <div className={VIDEO_TRIM_PANEL_FOOTER_CLASS}>
        <div className={VIDEO_TRIM_PANEL_FOOTER_LEFT_CLASS}>
          <div className="flex items-center gap-0.5">
            <Popover
              modal={false}
              open={highQualityHintOpen}
              onOpenChange={setHighQualityHintOpen}
            >
              <PopoverAnchor asChild>
                <label className="flex cursor-pointer items-center gap-2 text-xs">
                  <Switch
                    checked={draft.highQuality}
                    disabled={!ready}
                    onCheckedChange={handleHighQualityToggle}
                  />
                  <span>{t("workflow.videoTrim.highQuality")}</span>
                </label>
              </PopoverAnchor>
              <PopoverContent
                className="w-64 p-3 text-sm"
                align="start"
                side="top"
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="space-y-2">
                  <p>{t("workflow.videoTrim.notConfiguredHint")}</p>
                  <Link
                    to={interfacesUrl}
                    className="inline-block text-xs underline underline-offset-2"
                  >
                    {t("workflow.videoTrim.openAiInterfaces")}
                  </Link>
                </div>
              </PopoverContent>
            </Popover>
            <VideoTrimLocalTrimHintIcon
              open={localTrimHintOpen}
              onOpenChange={setLocalTrimHintOpen}
            />
          </div>
        </div>

        <div className={VIDEO_TRIM_PANEL_FOOTER_CENTER_CLASS}>
          {ready ? (
            <VideoTrimTimeFields
              videoDurationSec={draft.videoDurationSec ?? 0}
              range={draft.draftRange}
              minSelectionSec={SEEDANCE_2_5_VIDEO_EDIT_MIN_SEC}
              disabled={false}
              onRangeChange={handleDraftRangeChange}
              onRangeCommit={handleRangeCommit}
            />
          ) : draft.loadPhase === "error" ? (
            <p className="text-xs text-destructive">
              {t("workflow.videoRetake.loadFailed")}
            </p>
          ) : (
            <div className="h-7 w-40 animate-pulse rounded bg-neutral-200/80 dark:bg-neutral-700/60" />
          )}
        </div>

        <div className={VIDEO_TRIM_PANEL_FOOTER_ACTIONS_CLASS}>
          <button
            type="button"
            disabled={!ready}
            aria-label={
              draft.playbackPaused
                ? t("workflow.videoTrim.play")
                : t("workflow.videoTrim.pause")
            }
            className={VIDEO_TRIM_PANEL_ACTION_BUTTON_CLASS}
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              setPlaybackPaused(!draft.playbackPaused);
            }}
          >
            {draft.playbackPaused ? (
              <PlayIcon className="size-4" strokeWidth={2} />
            ) : (
              <PauseIcon className="size-4" strokeWidth={2} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
