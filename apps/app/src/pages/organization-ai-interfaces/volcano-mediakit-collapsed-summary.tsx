import {
  isVolcanoMediaKitActive,
  listEnabledVolcanoMediaKitSubtitleEraseModes,
  listEnabledVolcanoMediaKitVideoEnhanceModes,
  VOLCANO_MEDIKIT_CONSOLE_URL,
  VOLCANO_MEDIKIT_SUBTITLE_ERASE_MODE_LABEL_KEYS,
  VOLCANO_MEDIKIT_VIDEO_ENHANCE_MODE_LABEL_KEYS,
  type VolcanoMediaKitSnapshot,
} from "@dafthunk/types";

import { useTranslation } from "@/components/locale-provider";

const linkClassName =
  "text-primary underline-offset-4 hover:underline font-medium";

export function VolcanoMediaKitActivateLink() {
  const { t } = useTranslation();

  return (
    <a
      href={VOLCANO_MEDIKIT_CONSOLE_URL}
      target="_blank"
      rel="noreferrer"
      className={linkClassName}
    >
      {t("pages.aiInterfaces.mediaKitEnhance.activateLink")}
    </a>
  );
}

interface VolcanoMediaKitStatusDetailProps {
  readonly snapshot: VolcanoMediaKitSnapshot;
}

function formatFeatureSummary(params: {
  readonly sectionLabel: string;
  readonly modeLabels: readonly string[];
}): string {
  return `${params.sectionLabel}：${params.modeLabels.join("、")}`;
}

export function VolcanoMediaKitStatusDetail({
  snapshot,
}: VolcanoMediaKitStatusDetailProps) {
  const { t } = useTranslation();

  if (!snapshot.enabled) {
    return <VolcanoMediaKitActivateLink />;
  }

  if (!isVolcanoMediaKitActive(snapshot)) {
    return t("pages.aiInterfaces.mediaKitEnhance.configureHint");
  }

  const summaries: string[] = [];
  const videoModes = listEnabledVolcanoMediaKitVideoEnhanceModes(snapshot);
  if (videoModes.length > 0) {
    summaries.push(
      formatFeatureSummary({
        sectionLabel: t("pages.aiInterfaces.mediaKitEnhance.videoEnhanceSection"),
        modeLabels: videoModes.map((mode) =>
          t(VOLCANO_MEDIKIT_VIDEO_ENHANCE_MODE_LABEL_KEYS[mode])
        ),
      })
    );
  }

  const subtitleModes = listEnabledVolcanoMediaKitSubtitleEraseModes(snapshot);
  if (subtitleModes.length > 0) {
    summaries.push(
      formatFeatureSummary({
        sectionLabel: t("pages.aiInterfaces.mediaKitEnhance.subtitleEraseSection"),
        modeLabels: subtitleModes.map((mode) =>
          t(VOLCANO_MEDIKIT_SUBTITLE_ERASE_MODE_LABEL_KEYS[mode])
        ),
      })
    );
  }

  return <>{summaries.join("；")}</>;
}

interface VolcanoMediaKitCollapsedSummaryProps {
  readonly snapshot: VolcanoMediaKitSnapshot;
}

export function VolcanoMediaKitCollapsedSummary({
  snapshot,
}: VolcanoMediaKitCollapsedSummaryProps) {
  const { t } = useTranslation();

  return (
    <p className="text-muted-foreground text-xs leading-relaxed">
      {t("pages.aiInterfaces.mediaKitEnhance.cardTitle")}
      {" · "}
      <VolcanoMediaKitStatusDetail snapshot={snapshot} />
    </p>
  );
}

export function buildDefaultMediaKitSnapshot(): VolcanoMediaKitSnapshot {
  return {
    enabled: false,
    videoEnhance: {
      fast: false,
      standard: false,
      pro: false,
      llm: false,
    },
    subtitleErase: {
      standard: false,
      refined: false,
    },
  };
}
