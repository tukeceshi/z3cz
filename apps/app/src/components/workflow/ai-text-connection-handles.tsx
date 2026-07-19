import { Handle, Position, useConnection, useNodeId } from "@xyflow/react";
import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { cn } from "@/utils/utils";

import {
  AI_TEXT_CARD_HEIGHT_PX,
  AI_TEXT_KEYWORDS_HANDLE_ID,
  AI_TEXT_OUTPUT_ID,
} from "./ai-text-node-utils";
import {
  AI_TEXT_EDGE_PLUS_OUTER_PX,
  AI_TEXT_EDGE_SHELL_W_PX,
  AI_TEXT_HANDLE_HIT_PX,
  AI_TEXT_PLUS_BORDER_GAP_PX,
  AI_TEXT_HANDLE_PLUS_PX,
} from "./ai-text-connection-utils";

const AI_TEXT_HANDLE_RF_Y_OFFSET_PX = AI_TEXT_HANDLE_HIT_PX / 2;

const AI_TEXT_PLUS_Y_MAX_PX =
  AI_TEXT_HANDLE_HIT_PX / 2 - AI_TEXT_HANDLE_PLUS_PX / 2;

const interactionClass = "nodrag nopan nowheel cursor-default";

const hitHandleClass = cn(
  interactionClass,
  "!absolute !z-50",
  "!min-h-0 !min-w-0",
  "!overflow-visible !rounded-none !border-0 !bg-transparent !p-0 !shadow-none",
  "!opacity-0"
);

function clampPlusYOffset(y: number): number {
  return Math.max(-AI_TEXT_PLUS_Y_MAX_PX, Math.min(AI_TEXT_PLUS_Y_MAX_PX, y));
}

function AiTextHandlePlusIcon() {
  return (
    <svg
      width={AI_TEXT_HANDLE_PLUS_PX}
      height={AI_TEXT_HANDLE_PLUS_PX}
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

interface AiTextEdgeSideProps {
  readonly side: "left" | "right";
  readonly disabled?: boolean;
}

/**
 * Full-height edge column blocks node drag; inner 80×80 zone aligns Handle + plus.
 * Handle top is offset to cancel React Flow's translate(±40, -40) on custom handles.
 */
function AiTextEdgeSide({ side, disabled = false }: AiTextEdgeSideProps) {
  const nodeId = useNodeId();
  const connection = useConnection();
  const hitZoneRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [plusYOffset, setPlusYOffset] = useState(0);

  const isSource = side === "right";
  const handleId = isSource ? AI_TEXT_OUTPUT_ID : AI_TEXT_KEYWORDS_HANDLE_ID;

  const isDraggingFromHere =
    connection.inProgress &&
    connection.fromNode?.id === nodeId &&
    connection.fromHandle?.id === handleId;

  const showPlus = isActive || isDraggingFromHere;

  const columnPositionStyle =
    side === "left"
      ? {
          left: -AI_TEXT_EDGE_PLUS_OUTER_PX,
          top: 0,
        }
      : {
          right: -AI_TEXT_EDGE_PLUS_OUTER_PX,
          top: 0,
        };

  const handleStyle =
    side === "left"
      ? {
          left: AI_TEXT_EDGE_PLUS_OUTER_PX,
          top: AI_TEXT_HANDLE_RF_Y_OFFSET_PX,
          width: AI_TEXT_HANDLE_HIT_PX,
          height: AI_TEXT_HANDLE_HIT_PX,
        }
      : {
          left: 0,
          top: AI_TEXT_HANDLE_RF_Y_OFFSET_PX,
          width: AI_TEXT_HANDLE_HIT_PX,
          height: AI_TEXT_HANDLE_HIT_PX,
        };

  const plusLeft =
    side === "left"
      ? 0
      : AI_TEXT_HANDLE_HIT_PX + AI_TEXT_PLUS_BORDER_GAP_PX;

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
        disabled && "opacity-50"
      )}
      style={{
        width: AI_TEXT_EDGE_SHELL_W_PX,
        height: AI_TEXT_CARD_HEIGHT_PX,
        ...columnPositionStyle,
      }}
    >
      <div
        ref={hitZoneRef}
        className={cn(
          interactionClass,
          "pointer-events-auto absolute left-0 w-full",
          disabled && "pointer-events-none"
        )}
        style={{
          top: "50%",
          height: AI_TEXT_HANDLE_HIT_PX,
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
          isConnectableStart={!disabled}
          isConnectable={!disabled}
          className={hitHandleClass}
          style={handleStyle}
        />

        <div
          className={cn(
            "pointer-events-none absolute z-[60] transition-opacity duration-150",
            showPlus ? "opacity-100" : "opacity-0"
          )}
          style={{
            left: plusLeft,
            top: `calc(50% + ${plusYOffset}px)`,
            width: AI_TEXT_HANDLE_PLUS_PX,
            height: AI_TEXT_HANDLE_PLUS_PX,
            transform: "translateY(-50%)",
          }}
        >
          <AiTextHandlePlusIcon />
        </div>
      </div>
    </div>
  );
}

export interface AiTextConnectionSidesProps {
  readonly disabled?: boolean;
}

/** AI text node left/right connection UI. */
export function AiTextConnectionSides({
  disabled = false,
}: AiTextConnectionSidesProps) {
  return (
    <>
      <AiTextEdgeSide side="left" disabled={disabled} />
      <AiTextEdgeSide side="right" disabled={disabled} />
    </>
  );
}
