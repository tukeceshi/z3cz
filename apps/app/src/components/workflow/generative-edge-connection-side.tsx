import { Handle, Position, useConnection, useNodeId } from "@xyflow/react";
import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { cn } from "@/utils/utils";

import {
  AI_AUDIO_OUTPUT_ID,
  AI_AUDIO_PROMPT_HANDLE_ID,
} from "./ai-audio-node-utils";
import {
  AI_IMAGE_OUTPUT_ID,
  AI_IMAGE_PROMPT_HANDLE_ID,
  AI_IMAGE_REFERENCE_HANDLE_ID,
} from "./ai-image-node-utils";
import {
  AI_TEXT_KEYWORDS_HANDLE_ID,
  AI_TEXT_OUTPUT_ID,
} from "./ai-text-node-utils";
import {
  AI_VIDEO_OUTPUT_ID,
  AI_VIDEO_PROMPT_HANDLE_ID,
  AI_VIDEO_REFERENCE_HANDLE_ID,
} from "./ai-video-node-utils";
import {
  GENERATIVE_EDGE_HANDLE_HIT_PX,
  GENERATIVE_EDGE_PLUS_BORDER_GAP_PX,
  GENERATIVE_EDGE_PLUS_OUTER_PX,
  GENERATIVE_EDGE_PLUS_PX,
  GENERATIVE_EDGE_SHELL_W_PX,
} from "./generative-edge-connection-config";

const HANDLE_RF_Y_OFFSET_PX = GENERATIVE_EDGE_HANDLE_HIT_PX / 2;

const PLUS_Y_MAX_PX =
  GENERATIVE_EDGE_HANDLE_HIT_PX / 2 - GENERATIVE_EDGE_PLUS_PX / 2;

const interactionClass = "nodrag nopan nowheel cursor-default";

const hitHandleClass = cn(
  interactionClass,
  "!absolute !z-50",
  "!min-h-0 !min-w-0",
  "!overflow-visible !rounded-none !border-0 !bg-transparent !p-0 !shadow-none",
  "!opacity-0"
);

export type GenerativeEdgeModality = "text" | "image" | "video" | "audio";

export interface GenerativeEdgeSideConfig {
  readonly leftHandleId: string;
  readonly rightHandleId: string;
  readonly leftGhostHandleId?: string;
}

export const GENERATIVE_EDGE_SIDE_CONFIG: Readonly<
  Record<GenerativeEdgeModality, GenerativeEdgeSideConfig>
> = {
  text: {
    leftHandleId: AI_TEXT_KEYWORDS_HANDLE_ID,
    rightHandleId: AI_TEXT_OUTPUT_ID,
  },
  image: {
    leftHandleId: AI_IMAGE_REFERENCE_HANDLE_ID,
    rightHandleId: AI_IMAGE_OUTPUT_ID,
    leftGhostHandleId: AI_IMAGE_PROMPT_HANDLE_ID,
  },
  video: {
    leftHandleId: AI_VIDEO_REFERENCE_HANDLE_ID,
    rightHandleId: AI_VIDEO_OUTPUT_ID,
    leftGhostHandleId: AI_VIDEO_PROMPT_HANDLE_ID,
  },
  audio: {
    leftHandleId: AI_AUDIO_PROMPT_HANDLE_ID,
    rightHandleId: AI_AUDIO_OUTPUT_ID,
  },
};

function clampPlusYOffset(y: number): number {
  return Math.max(-PLUS_Y_MAX_PX, Math.min(PLUS_Y_MAX_PX, y));
}

function GenerativeEdgePlusIcon() {
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

interface GenerativeEdgeSideProps {
  readonly side: "left" | "right";
  readonly config: GenerativeEdgeSideConfig;
  readonly disabled?: boolean;
  readonly leftDisabled?: boolean;
}

/**
 * Full-height edge column blocks node drag; inner 80×80 zone aligns Handle + plus.
 * Handle top is offset to cancel React Flow's translate(±40, -40) on custom handles.
 */
function GenerativeEdgeSide({
  side,
  config,
  disabled = false,
  leftDisabled = false,
}: GenerativeEdgeSideProps) {
  const nodeId = useNodeId();
  const connection = useConnection();
  const hitZoneRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [plusYOffset, setPlusYOffset] = useState(0);

  const isSource = side === "right";
  const handleId = isSource ? config.rightHandleId : config.leftHandleId;
  const sideDisabled = disabled || (!isSource && leftDisabled);

  const isDraggingFromHere =
    connection.inProgress &&
    connection.fromNode?.id === nodeId &&
    connection.fromHandle?.id === handleId;

  const showPlus = isActive || isDraggingFromHere;

  const columnPositionStyle =
    side === "left"
      ? {
          left: -GENERATIVE_EDGE_PLUS_OUTER_PX,
          top: 0,
        }
      : {
          right: -GENERATIVE_EDGE_PLUS_OUTER_PX,
          top: 0,
        };

  const handleStyle =
    side === "left"
      ? {
          left: GENERATIVE_EDGE_PLUS_OUTER_PX,
          top: HANDLE_RF_Y_OFFSET_PX,
          width: GENERATIVE_EDGE_HANDLE_HIT_PX,
          height: GENERATIVE_EDGE_HANDLE_HIT_PX,
        }
      : {
          left: 0,
          top: HANDLE_RF_Y_OFFSET_PX,
          width: GENERATIVE_EDGE_HANDLE_HIT_PX,
          height: GENERATIVE_EDGE_HANDLE_HIT_PX,
        };

  const plusLeft =
    side === "left"
      ? 0
      : GENERATIVE_EDGE_HANDLE_HIT_PX + GENERATIVE_EDGE_PLUS_BORDER_GAP_PX;

  const updatePlusY = useCallback((clientY: number) => {
    const hitZone = hitZoneRef.current;
    if (!hitZone) return;
    const rect = hitZone.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    setPlusYOffset(clampPlusYOffset(clientY - centerY));
  }, []);

  const handlePointerOver = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      setIsActive(true);
      updatePlusY(event.clientY);
    },
    [updatePlusY]
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      setIsActive(true);
      updatePlusY(event.clientY);
    },
    [updatePlusY]
  );

  const handlePointerOut = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const hitZone = hitZoneRef.current;
      if (!hitZone) return;
      const next = event.relatedTarget;
      if (next instanceof Node && hitZone.contains(next)) return;
      setIsActive(false);
      setPlusYOffset(0);
    },
    []
  );

  return (
    <div
      className={cn(
        interactionClass,
        "pointer-events-none absolute z-40",
        sideDisabled && "opacity-50"
      )}
      style={{
        width: GENERATIVE_EDGE_SHELL_W_PX,
        height: "100%",
        ...columnPositionStyle,
      }}
    >
      <div
        ref={hitZoneRef}
        className={cn(
          interactionClass,
          "pointer-events-auto absolute left-0 w-full",
          sideDisabled && "pointer-events-none"
        )}
        style={{
          top: "50%",
          height: GENERATIVE_EDGE_HANDLE_HIT_PX,
          transform: "translateY(-50%)",
        }}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onPointerMove={handlePointerMove}
      >
        <Handle
          type={isSource ? "source" : "target"}
          position={isSource ? Position.Right : Position.Left}
          id={handleId}
          isConnectableStart={!sideDisabled}
          isConnectable={!sideDisabled}
          className={hitHandleClass}
          style={handleStyle}
        />

        {!isSource && config.leftGhostHandleId ? (
          <Handle
            type="target"
            position={Position.Left}
            id={config.leftGhostHandleId}
            isConnectable={false}
            isConnectableStart={false}
            className={hitHandleClass}
            style={handleStyle}
          />
        ) : null}

        <div
          className={cn(
            "pointer-events-none absolute z-[60] transition-opacity duration-150",
            showPlus ? "opacity-100" : "opacity-0"
          )}
          style={{
            left: plusLeft,
            top: `calc(50% + ${plusYOffset}px)`,
            width: GENERATIVE_EDGE_PLUS_PX,
            height: GENERATIVE_EDGE_PLUS_PX,
            transform: "translateY(-50%)",
          }}
        >
          <GenerativeEdgePlusIcon />
        </div>
      </div>
    </div>
  );
}

export interface GenerativeConnectionSidesProps {
  readonly modality: GenerativeEdgeModality;
  readonly disabled?: boolean;
  readonly leftDisabled?: boolean;
}

export function GenerativeConnectionSides({
  modality,
  disabled = false,
  leftDisabled = false,
}: GenerativeConnectionSidesProps) {
  const config = GENERATIVE_EDGE_SIDE_CONFIG[modality];

  return (
    <>
      <GenerativeEdgeSide
        side="left"
        config={config}
        disabled={disabled}
        leftDisabled={leftDisabled}
      />
      <GenerativeEdgeSide
        side="right"
        config={config}
        disabled={disabled}
      />
    </>
  );
}
