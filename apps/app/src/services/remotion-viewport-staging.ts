import { notifyAiMediaCacheChanged } from "@/services/ai-media-cache-events";
import {
  cacheMediaFromBlob,
  getCachedMediaBlob,
} from "@/services/ai-media-cache-service";

export const REMOTION_VIEWPORT_MEDIA_ID = "remotion-viewport";
export const REMOTION_VIEWPORT_MIME_TYPE = "application/json";

export const DEFAULT_REMOTION_SOURCE_CODE = `function Composition() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const titleEnter = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 120 },
  });
  const subtitleEnter = spring({
    frame: frame - 8,
    fps,
    config: { damping: 20, stiffness: 100 },
  });
  const barWidth = interpolate(frame, [12, 48], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const hueShift = interpolate(frame, [0, durationInFrames], [220, 280], {
    extrapolateRight: "clamp",
  });
  const orbX = interpolate(frame, [0, durationInFrames], [-120, 120]);
  const orbY = Math.sin(frame / 12) * 40;

  return (
    <AbsoluteFill
      style={{
        background: \`linear-gradient(135deg, hsl(\${hueShift}, 52%, 14%) 0%, hsl(\${hueShift + 40}, 45%, 8%) 100%)\`,
        fontFamily: "sans-serif",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          background: \`radial-gradient(circle, hsla(\${hueShift + 30}, 80%, 60%, 0.35) 0%, transparent 70%)\`,
          borderRadius: "50%",
          height: 420,
          left: "50%",
          position: "absolute",
          top: "42%",
          transform: \`translate(calc(-50% + \${orbX}px), calc(-50% + \${orbY}px))\`,
          width: 420,
        }}
      />
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          padding: 80,
        }}
      >
        <div
          style={{
            maxWidth: 900,
            opacity: titleEnter,
            textAlign: "center",
            transform: \`translateY(\${(1 - titleEnter) * 36}px) scale(\${0.92 + titleEnter * 0.08})\`,
          }}
        >
          <p
            style={{
              color: "rgba(255,255,255,0.55)",
              fontSize: 28,
              letterSpacing: 6,
              margin: "0 0 20px",
              opacity: subtitleEnter,
              textTransform: "uppercase",
            }}
          >
            Remotion Preview
          </p>
          <h1
            style={{
              color: "#f8fafc",
              fontSize: 88,
              fontWeight: 700,
              lineHeight: 1.05,
              margin: 0,
            }}
          >
            Preview
          </h1>
          <div
            style={{
              backgroundColor: "rgba(255,255,255,0.12)",
              borderRadius: 999,
              height: 8,
              margin: "36px auto 0",
              overflow: "hidden",
              width: 420,
            }}
          >
            <div
              style={{
                backgroundColor: \`hsl(\${hueShift + 20}, 85%, 62%)\`,
                borderRadius: 999,
                height: "100%",
                width: \`\${barWidth}%\`,
              }}
            />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}`;

export interface RemotionViewportContent {
  readonly sourceCode: string;
}

const EMPTY_CONTENT: RemotionViewportContent = {
  sourceCode: DEFAULT_REMOTION_SOURCE_CODE,
};

export function parseRemotionViewportContent(
  raw: string
): RemotionViewportContent {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return EMPTY_CONTENT;
    }
    const record = parsed as Record<string, unknown>;
    if (
      typeof record.sourceCode === "string" &&
      record.sourceCode.trim().length > 0
    ) {
      return { sourceCode: record.sourceCode };
    }
    return EMPTY_CONTENT;
  } catch {
    return EMPTY_CONTENT;
  }
}

export function serializeRemotionViewportContent(
  content: RemotionViewportContent
): string {
  return JSON.stringify({
    sourceCode: content.sourceCode,
  });
}

export async function readRemotionViewportContent(params: {
  readonly organizationId: string;
  readonly workflowId: string;
}): Promise<RemotionViewportContent> {
  const blob = await getCachedMediaBlob({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    mediaId: REMOTION_VIEWPORT_MEDIA_ID,
  });
  if (!blob) {
    return EMPTY_CONTENT;
  }
  return parseRemotionViewportContent(await blob.text());
}

export async function writeRemotionViewportContent(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly workflowName: string;
  readonly content: RemotionViewportContent;
}): Promise<void> {
  const stored = await cacheMediaFromBlob({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    workflowName: params.workflowName,
    mediaId: REMOTION_VIEWPORT_MEDIA_ID,
    blob: new Blob([serializeRemotionViewportContent(params.content)], {
      type: REMOTION_VIEWPORT_MIME_TYPE,
    }),
    mimeType: REMOTION_VIEWPORT_MIME_TYPE,
    nodeType: "remotion-preview",
  });
  if (stored) {
    notifyAiMediaCacheChanged();
  }
}
