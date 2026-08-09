import { useCallback, useMemo, useRef } from "react";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/utils/utils";
import {
  STUDIO_TEXT_PLAIN_SEGMENT,
  STUDIO_TEXT_PLAIN_SEGMENT_EDIT,
} from "./creative-studio-surface";
import {
  mergeMarkdownSegmentEdits,
  splitMarkdownTables,
  textSegmentKey,
} from "./split-markdown-tables";
import { patchMarkdownTableEdit } from "./patch-markdown-table-edit";
import { useStudioTextEditLeave } from "./studio-text-edit-leave";
import { StudioTextMdxEditor } from "./studio-text-mdx-editor";
import { StudioTextTablePreview } from "./studio-text-table-preview";

export interface StudioTextFormattedViewProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onBlur?: () => void;
  readonly onFocus?: () => void;
  readonly readOnly: boolean;
  readonly contentKey: string;
  readonly onLayoutUpdated?: () => void;
  readonly className?: string;
}

export function StudioTextFormattedView({
  value,
  onChange,
  onBlur,
  onFocus,
  readOnly,
  contentKey,
  onLayoutUpdated,
  className,
}: StudioTextFormattedViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const segments = useMemo(() => splitMarkdownTables(value), [value]);

  const { handleFocusOut, scheduleLeaveCheck } = useStudioTextEditLeave({
    containerRef,
    readOnly,
    onLeave: onBlur,
  });

  const applySegmentEdits = useCallback(
    (edits: {
      textUpdates?: ReadonlyMap<string, string>;
      tableUpdates?: ReadonlyMap<number, string>;
    }) => {
      onChange(mergeMarkdownSegmentEdits(value, segments, edits));
    },
    [onChange, segments, value]
  );

  const handleTableChange = useCallback(
    (tableIndex: number, tableMarkdown: string, originalTableMarkdown: string) => {
      applySegmentEdits({
        tableUpdates: new Map([
          [
            tableIndex,
            patchMarkdownTableEdit(originalTableMarkdown, tableMarkdown),
          ],
        ]),
      });
    },
    [applySegmentEdits]
  );

  const handleTextChange = useCallback(
    (segmentKey: string, text: string) => {
      applySegmentEdits({
        textUpdates: new Map([[segmentKey, text]]),
      });
    },
    [applySegmentEdits]
  );

  const handleContainerBlur = useCallback(() => {
    scheduleLeaveCheck();
  }, [scheduleLeaveCheck]);

  return (
    <div
      ref={containerRef}
      className={cn("min-h-full p-3", className)}
      onFocusOut={handleFocusOut}
    >
      {segments.map((segment, segmentIndex) => {
        if (segment.type === "text") {
          const text = value.slice(segment.start, segment.end);
          if (!text && readOnly) {
            return null;
          }

          const segmentKey = textSegmentKey(segment);
          const anchorKey = `${contentKey}-${segmentKey}`;

          if (readOnly) {
            if (!text) {
              return null;
            }
            return (
              <div
                key={segmentKey}
                data-studio-scroll-anchor={anchorKey}
                className={STUDIO_TEXT_PLAIN_SEGMENT}
              >
                {text}
              </div>
            );
          }

          return (
            <Textarea
              key={segmentKey}
              data-studio-scroll-anchor={anchorKey}
              value={text}
              onChange={(event) =>
                handleTextChange(segmentKey, event.target.value)
              }
              onFocus={onFocus}
              className={cn(
                STUDIO_TEXT_PLAIN_SEGMENT,
                STUDIO_TEXT_PLAIN_SEGMENT_EDIT
              )}
            />
          );
        }

        const tableMarkdown = value.slice(segment.start, segment.end);
        const tableAnchorKey = `${contentKey}-table-${segment.index}`;
        const prevSegment = segments[segmentIndex - 1];
        const followsText =
          prevSegment?.type === "text" &&
          value.slice(prevSegment.start, prevSegment.end).length > 0;
        const precedingText =
          prevSegment?.type === "text"
            ? value.slice(prevSegment.start, prevSegment.end)
            : "";

        if (readOnly) {
          return (
            <div key={tableAnchorKey} data-studio-scroll-anchor={tableAnchorKey}>
              <StudioTextTablePreview
                markdown={tableMarkdown}
                precedingText={precedingText}
                followsText={followsText}
              />
            </div>
          );
        }

        return (
          <div key={tableAnchorKey} data-studio-scroll-anchor={tableAnchorKey}>
            <StudioTextMdxEditor
              value={tableMarkdown}
              onChange={(markdown) =>
                handleTableChange(segment.index, markdown, tableMarkdown)
              }
              onBlur={handleContainerBlur}
              readOnly={false}
              precedingText={precedingText}
              followsText={followsText}
              contentKey={`${contentKey}-table-${segment.index}`}
              onLayoutUpdated={onLayoutUpdated}
            />
          </div>
        );
      })}
    </div>
  );
}
