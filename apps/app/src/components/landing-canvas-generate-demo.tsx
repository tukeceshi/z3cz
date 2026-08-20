import { AI_VIDEO_NODE_TYPE } from "@dafthunk/types";
import { Position } from "@xyflow/react";
import gsap from "gsap";
import FileText from "lucide-react/icons/file-text";
import ImageIcon from "lucide-react/icons/image";
import Network from "lucide-react/icons/network";
import PlayIcon from "lucide-react/icons/play";
import VideoIcon from "lucide-react/icons/video";
import { type ReactNode, useEffect, useRef, useState } from "react";

import {
  LANDING_CLIP_SRC as CLIP_SRC,
  LANDING_DOLLFACE_SRC as DOLLFACE_SRC,
  LANDING_SURVIVOR_SRC as SURVIVOR_SRC,
} from "@/bootstrap/landing-static-assets";
import { useTranslation } from "@/components/locale-provider";
import { ModelBrandIcon } from "@/components/model-brand-icon";
import { ActionBarButton, ActionBarGroup } from "@/components/ui/action-bar";
import { SURFACE_CARD } from "@/components/ui/surface";
import { AI_BOTTOM_CHIP_CLASS } from "@/components/workflow/ai-bottom-chip";
import { AiGenerateButton } from "@/components/workflow/ai-generate-button";
import { GenerativeCardEmptyUploadSlot } from "@/components/workflow/generative-card-empty-upload-slot";
import {
  GENERATIVE_NODE_CARD_CLASS,
  GENERATIVE_NODE_CARD_RADIUS_CLASS,
} from "@/components/workflow/generative-card-styles";
import {
  GENERATIVE_EDGE_PLUS_BORDER_GAP_PX,
  GENERATIVE_EDGE_PLUS_PX,
} from "@/components/workflow/generative-edge-connection-config";
import { WorkflowAddNodeMenuPanel } from "@/components/workflow/workflow-add-node-menu-panel";
import {
  buildWorkflowSmoothStepPath,
  renderWorkflowEdgePath,
} from "@/components/workflow/workflow-edge";
import { WorkflowMediaVideoPlayer } from "@/components/workflow/workflow-media-video-player";
import { cn } from "@/utils/utils";

const IMAGE_MODEL_ID = "gpt-image-2";
const VIDEO_MODEL_ID = "doubao-seedance-2-fast";
const DEMO_TYPE_MS = 70;
const IMAGE_EMPTY = 220;
const IMAGE_CLOSE_W = 180;
const IMAGE_CLOSE_H = 270;
const IMAGE_GRAPH_W = 90;
const IMAGE_GRAPH_H = 135;
const TEXT_MESSY_W = 176;
const TEXT_MESSY_H = 112;
const TEXT_W = 136;
const TEXT_H = (TEXT_MESSY_H * TEXT_W) / TEXT_MESSY_W;
const VIDEO_W = 200;
const VIDEO_H = 112;
const VIDEO_SHOW_W = 480;
const VIDEO_SHOW_H = 270;
const VIDEO_PROMPT_W = 360;
const VIDEO_PROMPT_PAD_X = 12;
const VIDEO_PROMPT_PAD_Y = 8;
const VIDEO_PROMPT_BODY_H = 88;
const VIDEO_PROMPT_FOOTER_GAP = 6;
const GEN_BTN_SIZE = 36;
const TYPE_INPUT_W = 320;
const TYPE_INPUT_H = 100;
const ADD_NODE_MENU_W = 168;
const ADD_NODE_MENU_H = 220;
const ADD_NODE_MENU_VIDEO_X = 56;
const ADD_NODE_MENU_VIDEO_Y = 128;
const PLUS_OUT =
  GENERATIVE_EDGE_PLUS_BORDER_GAP_PX + GENERATIVE_EDGE_PLUS_PX / 2;
const VIEW_H = 500;
const DEMO_SPAN_W = 720;
const LAYOUT_BTN_SCREEN_X = 30;
const LAYOUT_BTN_SCREEN_Y = VIEW_H - 30;
const LAYOUT_BTN_CLASS =
  "bg-white hover:bg-neutral-50 text-neutral-600 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200";

type DemoScene =
  | "wait"
  | "type"
  | "generateImage"
  | "imageReady"
  | "messy"
  | "createVideo"
  | "relayout"
  | "connect"
  | "videoFocus"
  | "videoGenerate"
  | "videoPreview"
  | "videoDone";

type DemoEdgeId = "dollface" | "text3" | "survivor";
type PlusNode = "dollface" | "text3" | "survivor" | "video";

interface DemoBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface DemoMotion {
  typedCount: number;
  zoom: number;
  camX: number;
  camY: number;
  cursorX: number;
  cursorY: number;
  cursorOn: number;
  dragOn: number;
  dragX2: number;
  dragY2: number;
  text1X: number;
  text1Y: number;
  text1W: number;
  text1H: number;
  text3X: number;
  text3Y: number;
  text3W: number;
  text3H: number;
  dollfaceX: number;
  dollfaceY: number;
  dollfaceW: number;
  dollfaceH: number;
  survivorX: number;
  survivorY: number;
  survivorW: number;
  survivorH: number;
  videoX: number;
  videoY: number;
  videoW: number;
  videoH: number;
}

interface ScreenPoint {
  readonly left: number;
  readonly top: number;
}

const MESSY = {
  text1: { x: 24, y: 20 },
  text3: { x: 36, y: 252 },
  dollface: { x: 168, y: 40 },
  survivor: { x: 292, y: 96 },
} as const;

const LAYOUT = {
  text1: { x: 24, y: 56 },
  text3: { x: 24, y: 280 },
  dollface: { x: 200, y: 24 },
  survivor: { x: 200, y: 220 },
  video: { x: 360, y: 140 },
} as const;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isBlockInViewportMiddle(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  const mid = window.innerHeight / 2;
  return rect.top < mid && rect.bottom > mid;
}

function cardRight(box: DemoBox): { readonly x: number; readonly y: number } {
  return { x: box.x + box.w, y: box.y + box.h / 2 };
}

function cardLeft(box: DemoBox): { readonly x: number; readonly y: number } {
  return { x: box.x, y: box.y + box.h / 2 };
}

function plusRight(box: DemoBox): { readonly x: number; readonly y: number } {
  return { x: box.x + box.w + PLUS_OUT, y: box.y + box.h / 2 };
}

function lookAt(box: DemoBox, zoom: number, vw: number, vh: number) {
  return {
    zoom,
    camX: vw / 2 - (box.x + box.w / 2) * zoom,
    camY: vh / 2 - (box.y + box.h / 2) * zoom,
  };
}

function screenToFlow(
  screenX: number,
  screenY: number,
  camX: number,
  camY: number,
  zoom: number
) {
  return {
    x: (screenX - camX) / zoom,
    y: (screenY - camY) / zoom,
  };
}

function typeInputGenBtnScreen(vw: number): ScreenPoint {
  return {
    left: vw / 2 + TYPE_INPUT_W / 2 - 32,
    top: VIEW_H / 2 + TYPE_INPUT_H / 2 - 26,
  };
}

function videoPromptBoxScreen(
  camX: number,
  camY: number,
  zoom: number,
  video: DemoBox
): ScreenPoint {
  return {
    left: camX + (video.x + video.w / 2) * zoom - VIDEO_PROMPT_W / 2,
    top: camY + (video.y + video.h) * zoom + 10,
  };
}

function videoPromptGenBtnScreen(promptBox: ScreenPoint): ScreenPoint {
  return {
    left:
      promptBox.left + VIDEO_PROMPT_W - VIDEO_PROMPT_PAD_X - GEN_BTN_SIZE / 2,
    top:
      promptBox.top +
      VIDEO_PROMPT_PAD_Y +
      VIDEO_PROMPT_BODY_H +
      VIDEO_PROMPT_FOOTER_GAP +
      GEN_BTN_SIZE / 2,
  };
}

function clampAddNodeMenuPos(
  left: number,
  top: number,
  vw: number
): ScreenPoint {
  return {
    left: Math.min(Math.max(8, left), Math.max(8, vw - ADD_NODE_MENU_W - 8)),
    top: Math.min(Math.max(8, top), Math.max(8, VIEW_H - ADD_NODE_MENU_H - 8)),
  };
}

function fitBoxes(boxes: readonly DemoBox[], vw: number, vh: number, pad = 40) {
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.w));
  const maxY = Math.max(...boxes.map((box) => box.y + box.h));
  const zoom = Math.min(
    (vw - pad * 2) / Math.max(maxX - minX, 1),
    (vh - pad * 2) / Math.max(maxY - minY, 1),
    1.1
  );
  return lookAt(
    { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
    zoom,
    vw,
    vh
  );
}

function fitBoxesFill(
  boxes: readonly DemoBox[],
  vw: number,
  vh: number,
  fill = 0.8
) {
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.w));
  const maxY = Math.max(...boxes.map((box) => box.y + box.h));
  const zoom = Math.min(
    (vw * fill) / Math.max(maxX - minX, 1),
    (vh * fill) / Math.max(maxY - minY, 1)
  );
  return lookAt(
    { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
    zoom,
    vw,
    vh
  );
}

function fitWithVideoPrompt(
  nodes: readonly DemoBox[],
  video: DemoBox,
  vw: number,
  vh: number,
  pad = 16
) {
  const promptH =
    VIDEO_PROMPT_PAD_Y * 2 +
    VIDEO_PROMPT_BODY_H +
    VIDEO_PROMPT_FOOTER_GAP +
    GEN_BTN_SIZE;
  const promptGap = 10;
  const minX = Math.min(...nodes.map((box) => box.x));
  const minY = Math.min(...nodes.map((box) => box.y));
  const maxX = Math.max(...nodes.map((box) => box.x + box.w));
  const maxY = Math.max(...nodes.map((box) => box.y + box.h));

  let lo = 0.2;
  let hi = 1.2;
  let zoom = 0.5;
  for (let i = 0; i < 16; i += 1) {
    const mid = (lo + hi) / 2;
    const promptW = VIDEO_PROMPT_W / mid;
    const promptFlowH = promptH / mid;
    const promptX = video.x + video.w / 2 - promptW / 2;
    const promptY = video.y + video.h + promptGap / mid;
    const left = Math.min(minX, promptX);
    const top = Math.min(minY, promptY);
    const right = Math.max(maxX, promptX + promptW);
    const bottom = Math.max(maxY, promptY + promptFlowH);
    const fits =
      mid <= (vw - pad * 2) / Math.max(right - left, 1) &&
      mid <= (vh - pad * 2) / Math.max(bottom - top, 1);
    if (fits) {
      zoom = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const promptW = VIDEO_PROMPT_W / zoom;
  const promptFlowH = promptH / zoom;
  const promptX = video.x + video.w / 2 - promptW / 2;
  const promptY = video.y + video.h + promptGap / zoom;
  const left = Math.min(minX, promptX);
  const top = Math.min(minY, promptY);
  return lookAt(
    {
      x: left,
      y: top,
      w: Math.max(maxX, promptX + promptW) - left,
      h: Math.max(maxY, promptY + promptFlowH) - top,
    },
    zoom,
    vw,
    vh
  );
}

function LandingCanvasDemoDots() {
  return (
    <div
      aria-hidden
      className="landing-canvas-demo-dots pointer-events-none absolute inset-0"
      style={{ backgroundSize: "15px 15px" }}
    />
  );
}

function DemoPlusIcon() {
  return (
    <svg
      width={GENERATIVE_EDGE_PLUS_PX}
      height={GENERATIVE_EDGE_PLUS_PX}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <circle cx="10" cy="10" r="9.35" className="fill-neutral-900/90" />
      <circle
        cx="10"
        cy="10"
        r="9.35"
        className="stroke-white/70"
        strokeWidth="1.2"
      />
      <path
        d="M10 6.5v7M6.5 10h7"
        className="stroke-white/70"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DemoCanvasNode(props: {
  readonly title: string;
  readonly icon: "text" | "image" | "video";
  readonly box: DemoBox;
  readonly nativeSize?: Pick<DemoBox, "w" | "h">;
  readonly highlight?: boolean;
  readonly plus?: "left" | "right";
  readonly zIndex?: number;
  readonly interactive?: boolean;
  readonly children: ReactNode;
}) {
  const Icon =
    props.icon === "text"
      ? FileText
      : props.icon === "video"
        ? VideoIcon
        : ImageIcon;
  const nativeW = props.nativeSize?.w ?? props.box.w;
  const nativeH = props.nativeSize?.h ?? props.box.h;
  const scale = props.box.w / nativeW;

  return (
    <div
      className={cn(
        "absolute",
        props.interactive ? "pointer-events-auto" : "pointer-events-none"
      )}
      style={{
        left: props.box.x,
        top: props.box.y,
        width: props.box.w,
        height: props.box.h,
        zIndex: props.zIndex ?? 10,
      }}
    >
      <div
        className="origin-top-left"
        style={{
          width: nativeW,
          transform: scale === 1 ? undefined : `scale(${scale})`,
        }}
      >
        <div className="absolute -top-5 left-0 z-10 flex max-w-full items-center gap-1 rounded-sm bg-card/40 px-1 py-0.5 backdrop-blur-sm">
          <Icon className="h-2.5 w-2.5 shrink-0 text-blue-500/70" />
          <span className="max-w-[140px] truncate text-[10px] font-medium text-muted-foreground">
            {props.title}
          </span>
        </div>
        <div
          className={cn(
            "bg-card shadow-xs relative border",
            GENERATIVE_NODE_CARD_CLASS,
            props.highlight && "generative-connect-target border-blue-400",
            !props.highlight && "border-border"
          )}
        >
          <div
            className={cn("overflow-hidden", GENERATIVE_NODE_CARD_RADIUS_CLASS)}
            style={{ width: nativeW, height: nativeH }}
          >
            {props.children}
          </div>
        </div>
      </div>
      {props.plus === "right" ? (
        <div
          className="pointer-events-none absolute top-1/2 -translate-y-1/2"
          style={{ right: -PLUS_OUT - GENERATIVE_EDGE_PLUS_PX / 2 }}
        >
          <DemoPlusIcon />
        </div>
      ) : null}
      {props.plus === "left" ? (
        <div
          className="pointer-events-none absolute top-1/2 -translate-y-1/2"
          style={{ left: -PLUS_OUT - GENERATIVE_EDGE_PLUS_PX / 2 }}
        >
          <DemoPlusIcon />
        </div>
      ) : null}
    </div>
  );
}

function DemoEdge(props: {
  readonly from: DemoBox;
  readonly to: DemoBox;
  readonly flowing?: boolean;
}) {
  const source = cardRight(props.from);
  const target = cardLeft(props.to);
  const path = buildWorkflowSmoothStepPath({
    sourceX: source.x,
    sourceY: source.y,
    targetX: target.x,
    targetY: target.y,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  });
  return (
    <g>
      {renderWorkflowEdgePath(path, props.flowing ? "#3b82f6" : "#d4d4d4", {
        isSelectionFlow: Boolean(props.flowing),
      })}
    </g>
  );
}

function DemoVideoCover(props: {
  readonly ready: boolean;
  readonly generating: boolean;
  readonly onClipReady?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const onClipReadyRef = useRef(props.onClipReady);
  const { t } = useTranslation();
  const shouldLoad = props.generating || props.ready;
  onClipReadyRef.current = props.onClipReady;

  useEffect(() => {
    if (!shouldLoad) {
      return;
    }
    const el = videoRef.current;
    if (!el) {
      return;
    }
    const notify = () => {
      onClipReadyRef.current?.();
    };
    el.preload = "auto";
    if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      notify();
      return;
    }
    el.addEventListener("canplay", notify);
    el.addEventListener("error", notify);
    el.load();
    return () => {
      el.removeEventListener("canplay", notify);
      el.removeEventListener("error", notify);
    };
  }, [shouldLoad]);

  if (!shouldLoad) {
    return (
      <GenerativeCardEmptyUploadSlot
        kind="video"
        size="canvas"
        busy={false}
        canUpload={false}
        onUploadClick={() => undefined}
      />
    );
  }

  return (
    <div
      className="relative size-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {props.ready && hovered ? (
        <WorkflowMediaVideoPlayer
          src={CLIP_SRC}
          variant="card"
          objectFit="cover"
          initialHovered
          className="absolute inset-0"
        />
      ) : (
        <>
          <video
            ref={videoRef}
            src={CLIP_SRC}
            className={cn(
              "size-full object-cover",
              !props.ready && "invisible"
            )}
            muted
            playsInline
            preload="auto"
          />
          {props.ready ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15">
              <PlayIcon className="h-8 w-8 text-white/85" strokeWidth={1.75} />
            </div>
          ) : (
            <div className="absolute inset-0">
              <GenerativeCardEmptyUploadSlot
                kind="video"
                size="canvas"
                busy
                busyMessage={t("workflow.aiVideoPanel.cardGenerating")}
                canUpload={false}
                onUploadClick={() => undefined}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function initialMotion(vw: number): DemoMotion {
  const emptyX = Math.max(16, (vw - IMAGE_EMPTY) / 2);
  const empty: DemoBox = {
    x: emptyX,
    y: 48,
    w: IMAGE_EMPTY,
    h: IMAGE_EMPTY,
  };
  const cam = lookAt(empty, 1, vw, VIEW_H);
  return {
    typedCount: 0,
    zoom: cam.zoom,
    camX: cam.camX,
    camY: cam.camY,
    cursorX: 0,
    cursorY: 0,
    cursorOn: 0,
    dragOn: 0,
    dragX2: 0,
    dragY2: 0,
    text1X: MESSY.text1.x,
    text1Y: MESSY.text1.y,
    text1W: TEXT_MESSY_W,
    text1H: TEXT_MESSY_H,
    text3X: MESSY.text3.x,
    text3Y: MESSY.text3.y,
    text3W: TEXT_MESSY_W,
    text3H: TEXT_MESSY_H,
    dollfaceX: empty.x,
    dollfaceY: empty.y,
    dollfaceW: IMAGE_EMPTY,
    dollfaceH: IMAGE_EMPTY,
    survivorX: MESSY.survivor.x,
    survivorY: MESSY.survivor.y,
    survivorW: IMAGE_CLOSE_W,
    survivorH: IMAGE_CLOSE_H,
    videoX: LAYOUT.video.x,
    videoY: LAYOUT.video.y,
    videoW: VIDEO_W,
    videoH: VIDEO_H,
  };
}

function layoutBoxes(motion: DemoMotion): {
  readonly text1: DemoBox;
  readonly text3: DemoBox;
  readonly dollface: DemoBox;
  readonly survivor: DemoBox;
  readonly video: DemoBox;
} {
  return {
    text1: {
      x: motion.text1X,
      y: motion.text1Y,
      w: motion.text1W,
      h: TEXT_MESSY_H * (motion.text1W / TEXT_MESSY_W),
    },
    text3: {
      x: motion.text3X,
      y: motion.text3Y,
      w: motion.text3W,
      h: TEXT_MESSY_H * (motion.text3W / TEXT_MESSY_W),
    },
    dollface: {
      x: motion.dollfaceX,
      y: motion.dollfaceY,
      w: motion.dollfaceW,
      h: motion.dollfaceH,
    },
    survivor: {
      x: motion.survivorX,
      y: motion.survivorY,
      w: motion.survivorW,
      h: motion.survivorH,
    },
    video: {
      x: motion.videoX,
      y: motion.videoY,
      w: motion.videoW,
      h: motion.videoH,
    },
  };
}

export function LandingCanvasGenerateDemo() {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [spanScale, setSpanScale] = useState(1);
  const motionRef = useRef<DemoMotion>(initialMotion(520));
  const [scene, setScene] = useState<DemoScene>("wait");
  const [motion, setMotion] = useState<DemoMotion>(() => initialMotion(520));
  const [showVideo, setShowVideo] = useState(false);
  const [highlightVideo, setHighlightVideo] = useState(false);
  const [layoutPressed, setLayoutPressed] = useState(false);
  const [plusSide, setPlusSide] = useState<"left" | "right" | null>(null);
  const [plusNode, setPlusNode] = useState<PlusNode | null>(null);
  const [edges, setEdges] = useState<readonly DemoEdgeId[]>([]);
  const [flowEdge, setFlowEdge] = useState<DemoEdgeId | null>(null);
  const [showAddNodeMenu, setShowAddNodeMenu] = useState(false);
  const [addMenuHover, setAddMenuHover] = useState(false);
  const [addMenuPos, setAddMenuPos] = useState<ScreenPoint>({
    left: 0,
    top: 0,
  });
  const [genHover, setGenHover] = useState<"image" | "video" | null>(null);
  const [genPressed, setGenPressed] = useState<"image" | "video" | null>(null);
  const clipReadyResolveRef = useRef<() => void>(() => undefined);

  const handleClipReady = () => {
    clipReadyResolveRef.current();
  };

  const prompt = t("landing.canvasDemoPrompt");
  const typedText = prompt.slice(0, Math.round(motion.typedCount));
  const hasTyped = Math.round(motion.typedCount) >= 1;
  const videoSolo = scene === "videoDone";
  const showImage = scene !== "wait" && scene !== "type" && !videoSolo;
  const showStack =
    scene === "messy" ||
    scene === "createVideo" ||
    scene === "relayout" ||
    scene === "connect" ||
    scene === "videoFocus" ||
    scene === "videoGenerate" ||
    scene === "videoPreview";
  const showTypeInput = scene === "type";
  const isImageLoading = scene === "generateImage";
  const showImageResult = showImage && scene !== "generateImage";
  const showLayoutBtn = scene === "messy";
  const showVideoInput =
    showVideo && scene !== "videoPreview" && scene !== "videoDone";
  const isVideoLoading = scene === "videoGenerate";
  const videoReady = scene === "videoPreview" || scene === "videoDone";
  const hasVideoTextRef = edges.includes("text3");
  const boxes = layoutBoxes(motion);
  const dragPreviewGreen = scene === "createVideo" || highlightVideo;
  const dragFrom =
    plusNode === "text3"
      ? plusRight(boxes.text3)
      : plusNode === "survivor"
        ? plusRight(boxes.survivor)
        : plusRight(boxes.dollface);

  useEffect(() => {
    const wrap = canvasWrapRef.current;
    if (!wrap) {
      return;
    }
    const updateScale = () => {
      const width = wrap.clientWidth;
      setSpanScale(width > 0 ? Math.min(1, width / DEMO_SPAN_W) : 1);
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) {
      return;
    }

    let timeline: gsap.core.Timeline | undefined;
    let playing = false;
    let finished = false;
    let wasInMiddle = false;

    const syncMotion = () => {
      setMotion({ ...motionRef.current });
    };

    const stopTimeline = () => {
      timeline?.kill();
      timeline = undefined;
    };

    const playSequence = () => {
      playing = true;
      finished = false;
      stopTimeline();
      const vw = canvas.clientWidth || 520;
      const start = initialMotion(vw);
      motionRef.current = start;
      setMotion(start);
      setShowVideo(false);
      setHighlightVideo(false);
      setLayoutPressed(false);
      setPlusSide(null);
      setPlusNode(null);
      setEdges([]);
      setFlowEdge(null);
      setShowAddNodeMenu(false);
      setAddMenuHover(false);
      setGenHover(null);
      setGenPressed(null);
      const clipReadyPromise = new Promise<void>((resolve) => {
        clipReadyResolveRef.current = resolve;
      });

      const closeX = Math.max(16, (vw - IMAGE_CLOSE_W) / 2);
      const messyBoxes: DemoBox[] = [
        {
          x: MESSY.text1.x,
          y: MESSY.text1.y,
          w: TEXT_MESSY_W,
          h: TEXT_MESSY_H,
        },
        {
          x: MESSY.text3.x,
          y: MESSY.text3.y,
          w: TEXT_MESSY_W,
          h: TEXT_MESSY_H,
        },
        {
          x: MESSY.dollface.x,
          y: MESSY.dollface.y,
          w: IMAGE_CLOSE_W,
          h: IMAGE_CLOSE_H,
        },
        {
          x: MESSY.survivor.x,
          y: MESSY.survivor.y,
          w: IMAGE_CLOSE_W,
          h: IMAGE_CLOSE_H,
        },
      ];
      const laidCards: DemoBox[] = [
        { x: LAYOUT.text1.x, y: LAYOUT.text1.y, w: TEXT_W, h: TEXT_H },
        { x: LAYOUT.text3.x, y: LAYOUT.text3.y, w: TEXT_W, h: TEXT_H },
        {
          x: LAYOUT.dollface.x,
          y: LAYOUT.dollface.y,
          w: IMAGE_GRAPH_W,
          h: IMAGE_GRAPH_H,
        },
        {
          x: LAYOUT.survivor.x,
          y: LAYOUT.survivor.y,
          w: IMAGE_GRAPH_W,
          h: IMAGE_GRAPH_H,
        },
      ];
      const videoBoxLaid: DemoBox = {
        x: LAYOUT.video.x,
        y: LAYOUT.video.y,
        w: VIDEO_W,
        h: VIDEO_H,
      };
      const messyCam = fitBoxes(messyBoxes, vw, VIEW_H, 48);
      const preVideoCam = fitBoxesFill(laidCards, vw, VIEW_H, 0.8);
      const promptCam = fitWithVideoPrompt(
        [...laidCards, videoBoxLaid],
        videoBoxLaid,
        vw,
        VIEW_H
      );
      const focusCam = lookAt(videoBoxLaid, 1.2, vw, VIEW_H);
      const showX = (vw / 2 - focusCam.camX) / focusCam.zoom - VIDEO_SHOW_W / 2;
      const showY =
        (VIEW_H / 2 - focusCam.camY) / focusCam.zoom - VIDEO_SHOW_H / 2;
      const videoDrop = cardLeft(videoBoxLaid);
      const layoutBtnFlow = screenToFlow(
        LAYOUT_BTN_SCREEN_X,
        LAYOUT_BTN_SCREEN_Y,
        messyCam.camX,
        messyCam.camY,
        messyCam.zoom
      );
      const addMenuScreen = clampAddNodeMenuPos(
        preVideoCam.camX + videoDrop.x * preVideoCam.zoom,
        preVideoCam.camY + videoDrop.y * preVideoCam.zoom,
        vw
      );
      const addMenuItemFlow = screenToFlow(
        addMenuScreen.left + ADD_NODE_MENU_VIDEO_X,
        addMenuScreen.top + ADD_NODE_MENU_VIDEO_Y,
        preVideoCam.camX,
        preVideoCam.camY,
        preVideoCam.zoom
      );
      const typeGenBtn = typeInputGenBtnScreen(vw);
      const typeGenFrom = screenToFlow(
        vw / 2,
        VIEW_H / 2,
        start.camX,
        start.camY,
        start.zoom
      );
      const typeGenTo = screenToFlow(
        typeGenBtn.left,
        typeGenBtn.top,
        start.camX,
        start.camY,
        start.zoom
      );
      const videoGenBtn = videoPromptGenBtnScreen(
        videoPromptBoxScreen(
          focusCam.camX,
          focusCam.camY,
          focusCam.zoom,
          videoBoxLaid
        )
      );
      const videoGenBtnFlow = screenToFlow(
        videoGenBtn.left,
        videoGenBtn.top,
        focusCam.camX,
        focusCam.camY,
        focusCam.zoom
      );

      if (prefersReducedMotion()) {
        const end = initialMotion(vw);
        end.typedCount = prompt.length;
        end.text1W = TEXT_W;
        end.text1H = TEXT_H;
        end.text3W = TEXT_W;
        end.text3H = TEXT_H;
        end.dollfaceW = IMAGE_GRAPH_W;
        end.dollfaceH = IMAGE_GRAPH_H;
        end.dollfaceX = LAYOUT.dollface.x;
        end.dollfaceY = LAYOUT.dollface.y;
        end.text1X = LAYOUT.text1.x;
        end.text1Y = LAYOUT.text1.y;
        end.text3X = LAYOUT.text3.x;
        end.text3Y = LAYOUT.text3.y;
        end.survivorX = LAYOUT.survivor.x;
        end.survivorY = LAYOUT.survivor.y;
        end.survivorW = IMAGE_GRAPH_W;
        end.survivorH = IMAGE_GRAPH_H;
        end.videoX = showX;
        end.videoY = showY;
        end.videoW = VIDEO_SHOW_W;
        end.videoH = VIDEO_SHOW_H;
        end.zoom = focusCam.zoom;
        end.camX = focusCam.camX;
        end.camY = focusCam.camY;
        motionRef.current = end;
        setMotion(end);
        setShowVideo(true);
        setEdges(["dollface", "text3", "survivor"]);
        setScene("videoDone");
        playing = false;
        finished = true;
        return;
      }

      setScene("type");
      timeline = gsap.timeline({
        onUpdate: syncMotion,
        onComplete: () => {
          playing = false;
          finished = true;
        },
      });

      timeline.to(motionRef.current, {
        typedCount: prompt.length,
        duration: (prompt.length * DEMO_TYPE_MS) / 1000,
        ease: "none",
      });
      timeline.call(() => {
        motionRef.current.cursorX = typeGenFrom.x;
        motionRef.current.cursorY = typeGenFrom.y;
        motionRef.current.cursorOn = 1;
        syncMotion();
      });
      timeline.to(motionRef.current, {
        cursorX: typeGenTo.x,
        cursorY: typeGenTo.y,
        duration: 0.45,
        ease: "power1.inOut",
      });
      timeline.call(() => {
        setGenHover("image");
      });
      timeline.call(
        () => {
          setGenPressed("image");
        },
        [],
        "+=0.12"
      );
      timeline.call(
        () => {
          setGenPressed(null);
          setGenHover(null);
          setScene("generateImage");
          motionRef.current.cursorOn = 0;
          syncMotion();
        },
        [],
        "+=0.1"
      );
      timeline.call(
        () => {
          setScene("imageReady");
        },
        [],
        "+=1.2"
      );
      timeline.to(motionRef.current, {
        dollfaceW: IMAGE_CLOSE_W,
        dollfaceH: IMAGE_CLOSE_H,
        dollfaceX: closeX,
        dollfaceY: 36,
        duration: 0.4,
        ease: "power2.out",
      });
      timeline.call(() => {
        const cam = lookAt(
          {
            x: motionRef.current.dollfaceX,
            y: motionRef.current.dollfaceY,
            w: IMAGE_CLOSE_W,
            h: IMAGE_CLOSE_H,
          },
          1,
          vw,
          VIEW_H
        );
        motionRef.current.zoom = cam.zoom;
        motionRef.current.camX = cam.camX;
        motionRef.current.camY = cam.camY;
        syncMotion();
      });
      timeline.call(
        () => {
          setScene("messy");
        },
        [],
        "+=0.45"
      );
      timeline.to(motionRef.current, {
        dollfaceX: MESSY.dollface.x,
        dollfaceY: MESSY.dollface.y,
        zoom: messyCam.zoom,
        camX: messyCam.camX,
        camY: messyCam.camY,
        duration: 0.7,
        ease: "power2.inOut",
      });
      timeline.to({}, { duration: 0.35 });
      timeline.call(() => {
        motionRef.current.cursorX =
          motionRef.current.dollfaceX + motionRef.current.dollfaceW / 2;
        motionRef.current.cursorY =
          motionRef.current.dollfaceY + motionRef.current.dollfaceH / 2;
        motionRef.current.cursorOn = 1;
        syncMotion();
      });
      timeline.to(motionRef.current, {
        cursorX: layoutBtnFlow.x,
        cursorY: layoutBtnFlow.y,
        duration: 0.55,
        ease: "power1.inOut",
      });
      timeline.call(() => {
        setLayoutPressed(true);
      });
      timeline.call(
        () => {
          setLayoutPressed(false);
          setScene("relayout");
          motionRef.current.cursorOn = 0;
          syncMotion();
        },
        [],
        "+=0.12"
      );
      timeline.to(motionRef.current, {
        text1X: LAYOUT.text1.x,
        text1Y: LAYOUT.text1.y,
        text1W: TEXT_W,
        text1H: TEXT_H,
        text3X: LAYOUT.text3.x,
        text3Y: LAYOUT.text3.y,
        text3W: TEXT_W,
        text3H: TEXT_H,
        dollfaceX: LAYOUT.dollface.x,
        dollfaceY: LAYOUT.dollface.y,
        dollfaceW: IMAGE_GRAPH_W,
        dollfaceH: IMAGE_GRAPH_H,
        survivorX: LAYOUT.survivor.x,
        survivorY: LAYOUT.survivor.y,
        survivorW: IMAGE_GRAPH_W,
        survivorH: IMAGE_GRAPH_H,
        videoX: LAYOUT.video.x,
        videoY: LAYOUT.video.y,
        zoom: preVideoCam.zoom,
        camX: preVideoCam.camX,
        camY: preVideoCam.camY,
        duration: 0.75,
        ease: "power2.inOut",
      });
      timeline.to({}, { duration: 0.3 });
      timeline.call(() => {
        setScene("createVideo");
        setPlusNode("dollface");
        setPlusSide("right");
        const from = plusRight({
          x: LAYOUT.dollface.x,
          y: LAYOUT.dollface.y,
          w: IMAGE_GRAPH_W,
          h: IMAGE_GRAPH_H,
        });
        motionRef.current.cursorX = from.x;
        motionRef.current.cursorY = from.y;
        motionRef.current.dragX2 = from.x;
        motionRef.current.dragY2 = from.y;
        motionRef.current.cursorOn = 1;
        motionRef.current.dragOn = 1;
        syncMotion();
      });
      timeline.to(motionRef.current, {
        cursorX: videoDrop.x,
        cursorY: videoDrop.y,
        dragX2: videoDrop.x,
        dragY2: videoDrop.y,
        duration: 0.7,
        ease: "power1.inOut",
      });
      timeline.call(() => {
        setAddMenuPos(addMenuScreen);
        setShowAddNodeMenu(true);
      });
      timeline.to({}, { duration: 0.2 });
      timeline.to(motionRef.current, {
        cursorX: addMenuItemFlow.x,
        cursorY: addMenuItemFlow.y,
        duration: 0.4,
        ease: "power1.inOut",
      });
      timeline.call(() => {
        setAddMenuHover(true);
      });
      timeline.call(
        () => {
          setAddMenuHover(false);
          setShowAddNodeMenu(false);
          setShowVideo(true);
          setHighlightVideo(true);
          setPlusNode("video");
          setPlusSide("left");
          motionRef.current.cursorX = videoDrop.x;
          motionRef.current.cursorY = videoDrop.y;
          motionRef.current.dragX2 = videoDrop.x;
          motionRef.current.dragY2 = videoDrop.y;
          syncMotion();
        },
        [],
        "+=0.22"
      );
      timeline.to(motionRef.current, {
        zoom: promptCam.zoom,
        camX: promptCam.camX,
        camY: promptCam.camY,
        duration: 0.55,
        ease: "power2.inOut",
      });
      timeline.call(() => {
        setHighlightVideo(false);
        setEdges(["dollface"]);
        setFlowEdge("dollface");
        motionRef.current.dragOn = 0;
        motionRef.current.cursorOn = 0;
        setPlusSide(null);
        setPlusNode(null);
        syncMotion();
      });
      timeline.to({}, { duration: 0.35 });
      timeline.call(() => {
        setScene("connect");
        setPlusNode("text3");
        setPlusSide("right");
        const from = plusRight({
          x: LAYOUT.text3.x,
          y: LAYOUT.text3.y,
          w: TEXT_W,
          h: TEXT_H,
        });
        motionRef.current.cursorX = from.x;
        motionRef.current.cursorY = from.y;
        motionRef.current.dragX2 = from.x;
        motionRef.current.dragY2 = from.y;
        motionRef.current.cursorOn = 1;
        motionRef.current.dragOn = 1;
        setHighlightVideo(true);
        syncMotion();
      });
      timeline.to(motionRef.current, {
        cursorX: LAYOUT.video.x,
        cursorY: LAYOUT.video.y + VIDEO_H / 2,
        dragX2: LAYOUT.video.x,
        dragY2: LAYOUT.video.y + VIDEO_H / 2,
        duration: 0.7,
        ease: "power1.inOut",
      });
      timeline.call(() => {
        setEdges(["dollface", "text3"]);
        setFlowEdge("text3");
        motionRef.current.dragOn = 0;
        motionRef.current.cursorOn = 0;
        setHighlightVideo(false);
        setPlusSide(null);
        setPlusNode(null);
        syncMotion();
      });
      timeline.to({}, { duration: 0.2 });
      timeline.call(() => {
        setPlusNode("survivor");
        setPlusSide("right");
        const from = plusRight({
          x: LAYOUT.survivor.x,
          y: LAYOUT.survivor.y,
          w: IMAGE_GRAPH_W,
          h: IMAGE_GRAPH_H,
        });
        motionRef.current.cursorX = from.x;
        motionRef.current.cursorY = from.y;
        motionRef.current.dragX2 = from.x;
        motionRef.current.dragY2 = from.y;
        motionRef.current.dragOn = 1;
        setHighlightVideo(true);
        syncMotion();
      });
      timeline.to(motionRef.current, {
        cursorX: LAYOUT.video.x,
        cursorY: LAYOUT.video.y + VIDEO_H / 2,
        dragX2: LAYOUT.video.x,
        dragY2: LAYOUT.video.y + VIDEO_H / 2,
        duration: 0.65,
        ease: "power1.inOut",
      });
      timeline.call(() => {
        setEdges(["dollface", "text3", "survivor"]);
        setFlowEdge("survivor");
        motionRef.current.dragOn = 0;
        motionRef.current.cursorOn = 0;
        setHighlightVideo(false);
        setPlusSide(null);
        setPlusNode(null);
        syncMotion();
      });
      timeline.call(
        () => {
          setFlowEdge(null);
          setScene("videoFocus");
        },
        [],
        "+=0.2"
      );
      timeline.to(motionRef.current, {
        zoom: focusCam.zoom,
        camX: focusCam.camX,
        camY: focusCam.camY,
        duration: 0.7,
        ease: "power2.inOut",
      });
      timeline.call(() => {
        motionRef.current.cursorOn = 1;
        syncMotion();
      });
      timeline.to(motionRef.current, {
        cursorX: videoGenBtnFlow.x,
        cursorY: videoGenBtnFlow.y,
        duration: 0.45,
        ease: "power1.inOut",
      });
      timeline.call(() => {
        setGenHover("video");
      });
      timeline.call(
        () => {
          setGenPressed("video");
        },
        [],
        "+=0.12"
      );
      timeline.call(
        () => {
          setGenPressed(null);
          setGenHover(null);
          setScene("videoGenerate");
          motionRef.current.cursorOn = 0;
          syncMotion();
        },
        [],
        "+=0.1"
      );
      timeline.addPause("+=0", () => {
        const seq = timeline;
        const minWait = new Promise<void>((resolve) => {
          window.setTimeout(resolve, 1000);
        });
        void Promise.all([minWait, clipReadyPromise]).then(() => {
          if (!playing || !seq) {
            return;
          }
          motionRef.current.cursorOn = 0;
          setScene("videoPreview");
          syncMotion();
          seq.resume();
        });
      });
      timeline.to({}, { duration: 0.4 });
      timeline.call(() => {
        setScene("videoDone");
      });
      timeline.to(motionRef.current, {
        videoX: showX,
        videoY: showY,
        videoW: VIDEO_SHOW_W,
        videoH: VIDEO_SHOW_H,
        duration: 0.9,
        ease: "sine.inOut",
      });
    };

    const tryStart = () => {
      const inMiddle = isBlockInViewportMiddle(root);
      if (playing) {
        wasInMiddle = inMiddle;
        return;
      }
      const canStart = inMiddle && (!finished || !wasInMiddle);
      wasInMiddle = inMiddle;
      if (canStart) {
        playSequence();
      }
    };

    const handleScroll = () => {
      window.requestAnimationFrame(tryStart);
    };

    tryStart();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      stopTimeline();
    };
  }, [prompt]);

  const promptReferenceHint = t(
    "workflow.aiVideoPanel.promptReferenceEditHint",
    {
      nodeName: t("landing.canvasDemoText3Name"),
    }
  );

  const videoScreen = {
    left: motion.camX + boxes.video.x * motion.zoom,
    top: motion.camY + boxes.video.y * motion.zoom,
    width: boxes.video.w * motion.zoom,
  };
  const cursorScreen = {
    left: motion.camX + motion.cursorX * motion.zoom,
    top: motion.camY + motion.cursorY * motion.zoom,
  };

  return (
    <div
      ref={rootRef}
      id="landing-canvas-demo"
      className="relative mx-auto mt-16 w-full max-w-[1100px] scroll-mt-20 py-8 text-left sm:py-10"
    >
      <div className="mb-10 text-center">
        <p className="text-xs text-muted-foreground">
          {t("landing.canvasDemoSectionLabel")}
        </p>
        <h2 className="mt-3 font-serif text-3xl font-semibold tracking-[-0.03em] text-balance text-foreground md:text-4xl md:leading-[1.25]">
          {t("landing.canvasDemoSectionTitle")}
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {t("landing.canvasDemoSectionBody")}
        </p>
      </div>
      <div className="grid items-center gap-8 md:grid-cols-5">
        <div className="flex flex-col items-start md:col-span-2">
          <p className="text-xs text-muted-foreground">
            {t("landing.canvasDemoLabel")}
          </p>
          <h3 className="mt-3 max-w-sm font-serif text-3xl font-semibold tracking-[-0.03em] text-balance text-foreground md:text-[2.125rem] md:leading-[1.25]">
            {t("landing.canvasDemoTitle")}
          </h3>
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
            {t("landing.canvasDemoBody")}
          </p>
        </div>

        <div
          ref={canvasWrapRef}
          className="relative w-full overflow-hidden md:col-span-3"
          style={{ height: VIEW_H * spanScale }}
        >
          <div
            ref={canvasRef}
            className="relative overflow-hidden"
            style={{
              width: spanScale < 1 ? DEMO_SPAN_W : "100%",
              height: VIEW_H,
              transform: spanScale < 1 ? `scale(${spanScale})` : undefined,
              transformOrigin: "top left",
            }}
          >
            <LandingCanvasDemoDots />
            <div
              className="pointer-events-none absolute origin-top-left"
              style={{
                left: 0,
                top: 0,
                width: 720,
                height: 560,
                transform: `translate(${motion.camX}px, ${motion.camY}px) scale(${motion.zoom})`,
              }}
            >
              <svg className="pointer-events-none absolute inset-0 size-full overflow-visible">
                {edges.includes("dollface") && showVideo && !videoSolo ? (
                  <DemoEdge
                    from={boxes.dollface}
                    to={boxes.video}
                    flowing={flowEdge === "dollface"}
                  />
                ) : null}
                {edges.includes("text3") && showVideo && !videoSolo ? (
                  <DemoEdge
                    from={boxes.text3}
                    to={boxes.video}
                    flowing={flowEdge === "text3"}
                  />
                ) : null}
                {edges.includes("survivor") && showVideo && !videoSolo ? (
                  <DemoEdge
                    from={boxes.survivor}
                    to={boxes.video}
                    flowing={flowEdge === "survivor"}
                  />
                ) : null}
                {motion.dragOn > 0 ? (
                  <g>
                    {renderWorkflowEdgePath(
                      buildWorkflowSmoothStepPath({
                        sourceX: dragFrom.x,
                        sourceY: dragFrom.y,
                        targetX: motion.dragX2,
                        targetY: motion.dragY2,
                        sourcePosition: Position.Right,
                        targetPosition: Position.Left,
                      }),
                      dragPreviewGreen ? "#16a34a" : "#d4d4d4",
                      {
                        isSelectionFlow: dragPreviewGreen,
                      }
                    )}
                  </g>
                ) : null}
              </svg>

              {showStack ? (
                <DemoCanvasNode
                  title={t("landing.canvasDemoText1Name")}
                  icon="text"
                  box={boxes.text1}
                  nativeSize={{ w: TEXT_MESSY_W, h: TEXT_MESSY_H }}
                  zIndex={12}
                >
                  <p className="h-full whitespace-pre-wrap break-words p-2.5 text-[10px] leading-4 text-foreground">
                    {t("landing.canvasDemoText1Excerpt")}
                  </p>
                </DemoCanvasNode>
              ) : null}

              {showStack ? (
                <DemoCanvasNode
                  title={t("landing.canvasDemoText3Name")}
                  icon="text"
                  box={boxes.text3}
                  nativeSize={{ w: TEXT_MESSY_W, h: TEXT_MESSY_H }}
                  plus={
                    plusNode === "text3" ? (plusSide ?? undefined) : undefined
                  }
                  zIndex={12}
                >
                  <p className="h-full whitespace-pre-wrap break-words p-2.5 text-[10px] leading-4 text-foreground">
                    {t("landing.canvasDemoText3Excerpt")}
                  </p>
                </DemoCanvasNode>
              ) : null}

              {showImage ? (
                <DemoCanvasNode
                  title={t("landing.canvasDemoDollfaceName")}
                  icon="image"
                  box={boxes.dollface}
                  nativeSize={
                    showStack
                      ? { w: IMAGE_CLOSE_W, h: IMAGE_CLOSE_H }
                      : undefined
                  }
                  plus={
                    plusNode === "dollface"
                      ? (plusSide ?? undefined)
                      : undefined
                  }
                  zIndex={14}
                >
                  {showImageResult ? (
                    <img
                      src={DOLLFACE_SRC}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <GenerativeCardEmptyUploadSlot
                      kind="image"
                      size="canvas"
                      busy={isImageLoading}
                      busyMessage={
                        isImageLoading
                          ? t("workflow.aiImagePanel.cardGenerating")
                          : undefined
                      }
                      canUpload={false}
                      onUploadClick={() => undefined}
                    />
                  )}
                </DemoCanvasNode>
              ) : null}

              {showStack ? (
                <DemoCanvasNode
                  title={t("landing.canvasDemoSurvivorName")}
                  icon="image"
                  box={boxes.survivor}
                  nativeSize={{ w: IMAGE_CLOSE_W, h: IMAGE_CLOSE_H }}
                  plus={
                    plusNode === "survivor"
                      ? (plusSide ?? undefined)
                      : undefined
                  }
                  zIndex={12}
                >
                  <img
                    src={SURVIVOR_SRC}
                    alt=""
                    className="size-full object-cover"
                  />
                </DemoCanvasNode>
              ) : null}

              {showVideo ? (
                <DemoCanvasNode
                  title={t("landing.canvasDemoVideoName")}
                  icon="video"
                  box={boxes.video}
                  highlight={highlightVideo}
                  plus={
                    plusNode === "video" ? (plusSide ?? undefined) : undefined
                  }
                  zIndex={videoReady || isVideoLoading ? 24 : 16}
                  interactive={videoReady}
                >
                  <DemoVideoCover
                    ready={videoReady}
                    generating={isVideoLoading}
                    onClipReady={handleClipReady}
                  />
                </DemoCanvasNode>
              ) : null}
            </div>

            {motion.cursorOn > 0 ? (
              <div
                aria-hidden
                className="pointer-events-none absolute z-50 size-4 -translate-x-0.5 -translate-y-0.5"
                style={{ left: cursorScreen.left, top: cursorScreen.top }}
              >
                <svg viewBox="0 0 24 24" className="size-4 drop-shadow-sm">
                  <path
                    d="M4 3l14 8-6 1.5L10 21z"
                    className="fill-foreground stroke-background"
                    strokeWidth="1.2"
                  />
                </svg>
              </div>
            ) : null}

            {showAddNodeMenu ? (
              <div
                className="pointer-events-none absolute z-40"
                style={{ left: addMenuPos.left, top: addMenuPos.top }}
              >
                <WorkflowAddNodeMenuPanel
                  onSelect={() => undefined}
                  highlightedType={
                    addMenuHover ? AI_VIDEO_NODE_TYPE : undefined
                  }
                />
              </div>
            ) : null}

            {showLayoutBtn ? (
              <div
                className={cn(
                  "pointer-events-none absolute bottom-3 left-3 z-20 transition-transform",
                  layoutPressed && "translate-y-px scale-95"
                )}
              >
                <ActionBarGroup>
                  <ActionBarButton
                    onClick={() => undefined}
                    className={LAYOUT_BTN_CLASS}
                  >
                    <Network className="size-4" />
                  </ActionBarButton>
                </ActionBarGroup>
              </div>
            ) : null}

            {showTypeInput ? (
              <div
                className={cn(
                  "pointer-events-none absolute top-1/2 left-1/2 z-20 flex w-[320px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg px-3.5 py-3",
                  SURFACE_CARD
                )}
              >
                <p className="min-h-8 text-left text-[15px] leading-5 text-foreground">
                  {typedText}
                  {scene === "type" ? (
                    <span
                      aria-hidden
                      className="ml-px inline-block h-[1em] w-px translate-y-0.5 bg-foreground/70"
                    />
                  ) : null}
                </p>
                <div className="mt-1.5 flex items-end justify-between gap-2">
                  <span className={cn(AI_BOTTOM_CHIP_CLASS, "opacity-100")}>
                    <ModelBrandIcon
                      canonicalId={IMAGE_MODEL_ID}
                      className="size-4"
                    />
                    <span className="truncate">
                      {t("landing.canvasDemoModel")}
                    </span>
                  </span>
                  <AiGenerateButton
                    disabled={!hasTyped}
                    isGenerating={isImageLoading}
                    className={cn(
                      genHover === "image" &&
                        "bg-neutral-500 dark:bg-neutral-200",
                      genPressed === "image" && "scale-95"
                    )}
                    label={
                      isImageLoading
                        ? t("workflow.aiImagePanel.generating")
                        : t("workflow.aiImagePanel.generate")
                    }
                    onClick={() => undefined}
                  />
                </div>
              </div>
            ) : null}

            {showVideoInput ? (
              <div
                className={cn(
                  "pointer-events-none absolute z-20 flex flex-col overflow-hidden rounded-lg px-3 py-2",
                  SURFACE_CARD
                )}
                style={{
                  left:
                    videoScreen.left +
                    videoScreen.width / 2 -
                    VIDEO_PROMPT_W / 2,
                  top: videoScreen.top + boxes.video.h * motion.zoom + 10,
                  width: VIDEO_PROMPT_W,
                }}
              >
                <div className="relative min-h-[72px] overflow-hidden">
                  {hasVideoTextRef ? (
                    <>
                      <p className="line-clamp-4 px-2 py-3 text-[11px] leading-4 text-foreground">
                        {t("landing.canvasDemoText3Excerpt")}
                      </p>
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-3">
                        <p
                          className={cn(
                            "max-w-[92%] truncate rounded-lg border px-3 py-2 text-center text-xs leading-4 shadow-sm backdrop-blur-[2px]",
                            "border-border/40 bg-background/50 text-muted-foreground"
                          )}
                        >
                          {promptReferenceHint}
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="px-1 py-2 text-[11px] leading-4 text-muted-foreground">
                      {t("workflow.aiVideoPanel.promptPlaceholder")}
                    </p>
                  )}
                </div>
                <div className="mt-1.5 flex items-end justify-between gap-2">
                  <span className={cn(AI_BOTTOM_CHIP_CLASS, "opacity-100")}>
                    <ModelBrandIcon
                      canonicalId={VIDEO_MODEL_ID}
                      className="size-4"
                    />
                    <span className="truncate">
                      {t("landing.canvasDemoVideoModel")}
                    </span>
                  </span>
                  <AiGenerateButton
                    disabled={!hasVideoTextRef}
                    isGenerating={isVideoLoading}
                    className={cn(
                      genHover === "video" &&
                        "bg-neutral-500 dark:bg-neutral-200",
                      genPressed === "video" && "scale-95"
                    )}
                    label={
                      isVideoLoading
                        ? t("workflow.aiVideoPanel.generating")
                        : t("workflow.aiVideoPanel.generate")
                    }
                    onClick={() => undefined}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
