import type { WorkflowMediaValue } from "@dafthunk/types";
import { isWorkflowMediaValue } from "@dafthunk/types";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { useReferenceThumbUrl } from "@/hooks/use-reference-thumb-url";

import type { AiTextReferenceChip } from "./ai-text-reference-bar";

function mediaNodeTypeForChip(
  chip: AiTextReferenceChip
): "ai-image" | "ai-video" | undefined {
  if (chip.kind === "image") return "ai-image";
  if (chip.kind === "video") return "ai-video";
  return undefined;
}

function chipMedia(chip: AiTextReferenceChip): WorkflowMediaValue | null {
  return chip.media && isWorkflowMediaValue(chip.media) ? chip.media : null;
}

function ReferenceThumbUrlCollector({
  chip,
  onResolved,
}: {
  readonly chip: AiTextReferenceChip;
  readonly onResolved: (
    edgeId: string,
    thumbUrl: string | null | undefined
  ) => void;
}) {
  const { displayUrl, phase } = useReferenceThumbUrl({
    media: chipMedia(chip),
    nodeType: mediaNodeTypeForChip(chip),
  });

  useEffect(() => {
    if (phase === "ready") {
      onResolved(chip.edgeId, displayUrl);
      return;
    }
    if (phase === "missing") {
      onResolved(chip.edgeId, null);
      return;
    }
    onResolved(chip.edgeId, undefined);
  }, [chip.edgeId, displayUrl, onResolved, phase]);

  return null;
}

export interface ReferenceThumbUrlsProviderProps {
  readonly chips: readonly AiTextReferenceChip[];
  readonly children: (
    thumbUrls: ReadonlyMap<string, string | null>
  ) => ReactNode;
}

export function ReferenceThumbUrlsProvider({
  chips,
  children,
}: ReferenceThumbUrlsProviderProps) {
  const [thumbUrls, setThumbUrls] = useState<
    ReadonlyMap<string, string | null>
  >(() => new Map());

  const handleResolved = useCallback(
    (edgeId: string, thumbUrl: string | null | undefined) => {
      setThumbUrls((current) => {
        if (thumbUrl === undefined) {
          if (!current.has(edgeId)) {
            return current;
          }
          const next = new Map(current);
          next.delete(edgeId);
          return next;
        }
        if (current.get(edgeId) === thumbUrl) {
          return current;
        }
        const next = new Map(current);
        next.set(edgeId, thumbUrl);
        return next;
      });
    },
    []
  );

  return (
    <>
      {chips.map((chip) => (
        <ReferenceThumbUrlCollector
          key={chip.edgeId}
          chip={chip}
          onResolved={handleResolved}
        />
      ))}
      {children(thumbUrls)}
    </>
  );
}
