import {
  getResourceIdFromValue,
  type MediaReference,
  type VideoEnhanceNodeConfig,
  type VolcanoMediaKitPricingResolution,
} from "@dafthunk/types";
import SparklesIcon from "lucide-react/icons/sparkles";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { useDismissOnCanvasPointerDown } from "@/hooks/use-dismiss-on-canvas-pointer-down";
import { useOrgUrl } from "@/hooks/use-org-url";
import { useOrgVolcanoMediaKitConfig } from "@/hooks/use-volcano-mediakit-config";
import { useAppToast } from "@/hooks/use-app-toast";

import {
  AI_VIDEO_ENHANCE_PANEL_ACTIONS_CLASS,
  AI_VIDEO_ENHANCE_PANEL_POPOVER_CLASS,
  AI_VIDEO_ENHANCE_PANEL_WIDTH_PX,
} from "./ai-video-enhance-panel-styles";
import {
  AiVideoEnhanceSettingsPanel,
  createDefaultVideoEnhanceConfig,
} from "./ai-video-enhance-settings-panel";
import { AiGenerateButton } from "./ai-generate-button";
import {
  GENERATIVE_NODE_PANEL_TOOLBAR_BUTTON_CLASS,
  GENERATIVE_NODE_PANEL_TOOLBAR_ICON_CLASS,
} from "./generative-card-styles";
import { useVideoEnhanceToSiblingNode } from "./use-video-enhance-to-sibling-node";
import {
  readVideoEnhanceSourceTierFromNode,
  resolveVideoEnhanceSourceTier,
  resolveVideoEnhanceSourceTierFromCache,
} from "./video-enhance-node-utils";
import { useWorkflow } from "./workflow-context";
import type { WorkflowNodeType } from "./workflow-types";

export interface VideoEnhanceToolbarButtonProps {
  readonly sourceNodeId: string;
  readonly sourceNodeData: WorkflowNodeType;
  readonly sourceVideo: MediaReference;
  readonly disabled?: boolean;
}

export function VideoEnhanceToolbarButton({
  sourceNodeId,
  sourceNodeData,
  sourceVideo,
  disabled = false,
}: VideoEnhanceToolbarButtonProps) {
  const { t } = useTranslation();
  const toast = useAppToast();
  const { organization } = useAuth();
  const orgId = organization?.id;
  const { id: workflowId } = useParams<{ id: string }>();
  const { getOrgUrl } = useOrgUrl();
  const { disabled: workflowDisabled } = useWorkflow();
  const { createEnhanceSiblingNode } = useVideoEnhanceToSiblingNode(sourceNodeId);
  const {
    interfaceId: mediaKitInterfaceId,
    config: mediaKitConfig,
    isLoading: isMediaKitLoading,
  } = useOrgVolcanoMediaKitConfig(orgId);

  const [open, setOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [sourceTier, setSourceTier] = useState<VolcanoMediaKitPricingResolution | null>(
    null
  );
  const [draftConfig, setDraftConfig] = useState<VideoEnhanceNodeConfig | null>(null);
  const cacheTierRequestRef = useRef(0);

  const enabledModes = mediaKitConfig?.enabledVideoModes ?? [];
  const mediaKitReady =
    !isMediaKitLoading &&
    Boolean(
      mediaKitConfig?.active &&
        mediaKitConfig.enabledVideoModes.length > 0 &&
        mediaKitConfig.hasApiKey
    );

  const canGenerate = Boolean(
    draftConfig &&
      enabledModes.length > 0 &&
      mediaKitReady &&
      !disabled &&
      !workflowDisabled
  );

  const resetPopoverState = useCallback(() => {
    setShowHint(false);
    setDraftConfig(null);
    setSourceTier(null);
    cacheTierRequestRef.current += 1;
  }, []);

  const dismissPopover = useCallback(() => {
    setOpen(false);
    resetPopoverState();
  }, [resetPopoverState]);

  useDismissOnCanvasPointerDown(open, dismissPopover);

  const openPopover = useCallback(() => {
    if (!orgId || !mediaKitInterfaceId) {
      resetPopoverState();
      setShowHint(true);
      setOpen(true);
      return;
    }

    const tierFromNode = readVideoEnhanceSourceTierFromNode(sourceNodeData);
    const initialTier = resolveVideoEnhanceSourceTier(tierFromNode);
    const modes = mediaKitConfig?.enabledVideoModes ?? [];

    setShowHint(false);
    setSourceTier(initialTier);
    setDraftConfig(modes.length > 0 ? createDefaultVideoEnhanceConfig(modes, initialTier) : null);
    setOpen(true);

    if (
      tierFromNode !== null ||
      !workflowId ||
      modes.length === 0 ||
      !mediaKitReady
    ) {
      return;
    }

    const mediaId = getResourceIdFromValue(sourceVideo);
    if (!mediaId) {
      return;
    }

    const requestId = cacheTierRequestRef.current + 1;
    cacheTierRequestRef.current = requestId;

    void resolveVideoEnhanceSourceTierFromCache({
      organizationId: orgId,
      workflowId,
      mediaId,
    }).then((tierFromCache) => {
      if (cacheTierRequestRef.current !== requestId || !tierFromCache) {
        return;
      }
      setSourceTier(tierFromCache);
      setDraftConfig((current) => {
        if (!current) {
          return createDefaultVideoEnhanceConfig(modes, tierFromCache);
        }
        return createDefaultVideoEnhanceConfig(modes, tierFromCache);
      });
    });
  }, [
    mediaKitConfig?.enabledVideoModes,
    mediaKitInterfaceId,
    mediaKitReady,
    orgId,
    resetPopoverState,
    sourceNodeData,
    sourceVideo,
    workflowId,
  ]);

  useEffect(() => {
    if (!open || showHint || !mediaKitReady || draftConfig) {
      return;
    }
    const modes = mediaKitConfig?.enabledVideoModes ?? [];
    if (modes.length === 0) {
      return;
    }
    const tierFromNode = readVideoEnhanceSourceTierFromNode(sourceNodeData);
    const initialTier = resolveVideoEnhanceSourceTier(tierFromNode);
    setSourceTier(initialTier);
    setDraftConfig(createDefaultVideoEnhanceConfig(modes, initialTier));
  }, [
    draftConfig,
    mediaKitConfig?.enabledVideoModes,
    mediaKitReady,
    open,
    showHint,
    sourceNodeData,
  ]);

  useEffect(() => {
    if (!open || mediaKitReady || isMediaKitLoading) {
      return;
    }
    if (
      mediaKitConfig &&
      (!mediaKitConfig.active ||
        mediaKitConfig.enabledVideoModes.length === 0 ||
        !mediaKitConfig.hasApiKey)
    ) {
      setShowHint(true);
      setDraftConfig(null);
    }
  }, [isMediaKitLoading, mediaKitConfig, mediaKitReady, open]);

  const handleTriggerClick = useCallback(() => {
    if (
      mediaKitConfig &&
      !isMediaKitLoading &&
      (!mediaKitConfig.active ||
        mediaKitConfig.enabledVideoModes.length === 0 ||
        !mediaKitConfig.hasApiKey)
    ) {
      resetPopoverState();
      setShowHint(true);
      setOpen(true);
      return;
    }

    if (mediaKitReady) {
      openPopover();
      return;
    }

    resetPopoverState();
    setOpen(true);
  }, [isMediaKitLoading, mediaKitConfig, mediaKitReady, openPopover, resetPopoverState]);

  const handleGenerate = useCallback(() => {
    if (!canGenerate || !draftConfig) {
      return;
    }

    const sourceResourceId = getResourceIdFromValue(sourceVideo);
    const result = createEnhanceSiblingNode({
      ...draftConfig,
      ...(sourceResourceId ? { sourceResourceId } : {}),
    });
    if (!result) {
      toast.error("workflow.videoEnhance.createNodeFailed");
      return;
    }

    dismissPopover();

    if (!result.referenceLinked) {
      toast.error("workflow.videoEnhance.referenceLinkFailed");
    }
  }, [
    canGenerate,
    createEnhanceSiblingNode,
    dismissPopover,
    draftConfig,
    sourceVideo,
    toast,
  ]);

  const interfacesUrl = useMemo(
    () =>
      mediaKitInterfaceId
        ? getOrgUrl(`/ai-interfaces/${mediaKitInterfaceId}`)
        : getOrgUrl("/ai-interfaces"),
    [getOrgUrl, mediaKitInterfaceId]
  );

  return (
    <Popover
      modal={false}
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          dismissPopover();
        }
      }}
    >
      <PopoverAnchor asChild>
        <button
          type="button"
          disabled={disabled || workflowDisabled}
          className={GENERATIVE_NODE_PANEL_TOOLBAR_BUTTON_CLASS}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            handleTriggerClick();
          }}
        >
          <SparklesIcon
            className={GENERATIVE_NODE_PANEL_TOOLBAR_ICON_CLASS}
            strokeWidth={2}
          />
          <span>{t("workflow.videoEnhance.action")}</span>
        </button>
      </PopoverAnchor>
      <PopoverContent
        className={AI_VIDEO_ENHANCE_PANEL_POPOVER_CLASS}
        style={{ width: AI_VIDEO_ENHANCE_PANEL_WIDTH_PX }}
        align="center"
        side="bottom"
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {showHint ? (
          <div className="space-y-2 p-3 text-sm">
            <p>{t("workflow.videoEnhance.notConfiguredHint")}</p>
            <Link
              to={interfacesUrl}
              className="inline-block text-xs underline underline-offset-2"
            >
              {t("workflow.videoEnhance.openAiInterfaces")}
            </Link>
          </div>
        ) : draftConfig && sourceTier ? (
          <>
            <AiVideoEnhanceSettingsPanel
              enabledModes={enabledModes}
              sourceTier={sourceTier}
              value={draftConfig}
              disabled={disabled || workflowDisabled}
              onChange={setDraftConfig}
            />
            <div className={AI_VIDEO_ENHANCE_PANEL_ACTIONS_CLASS}>
              <AiGenerateButton
                disabled={!canGenerate}
                isGenerating={false}
                isCancelling={false}
                canCancel={false}
                label={t("workflow.videoEnhance.generate")}
                cancelLabel={t("workflow.generativeCancel.action")}
                onClick={handleGenerate}
                onCancel={() => {}}
              />
            </div>
          </>
        ) : isMediaKitLoading ? (
          <div className="p-4 text-sm text-muted-foreground">{t("common.loading")}</div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
