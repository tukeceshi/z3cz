import { useCallback, useMemo, useRef } from "react";

import { cn } from "@/utils/utils";
import {
  sectionBodyMarkdown,
  sectionPrecedingText,
  splitMarkdownSections,
} from "./split-markdown-sections";
import {
  mergeMarkdownSegmentEdits,
  splitMarkdownTables,
} from "./split-markdown-tables";
import { patchMarkdownTableEdit } from "./patch-markdown-table-edit";
import { useStudioTextEditLeave } from "./studio-text-edit-leave";
import { StudioTextMarkdownRange } from "./studio-text-markdown-range";
import { StudioTextSectionFrameActions } from "./studio-text-section-frame-actions";

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
  const sections = useMemo(() => splitMarkdownSections(value), [value]);
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

  const rangeProps = {
    value,
    segments,
    readOnly,
    onFocus,
    onTextChange: handleTextChange,
    onTableChange: handleTableChange,
    onContainerBlur: handleContainerBlur,
    onLayoutUpdated,
  };

  return (
    <div
      ref={containerRef}
      className={cn("min-h-full p-3", className)}
      onFocusOut={handleFocusOut}
    >
      {sections.map((part) => {
        if (part.type === "preamble") {
          const preamble = value.slice(part.start, part.end);
          if (!preamble && readOnly) {
            return null;
          }

          return (
            <StudioTextMarkdownRange
              key={`${contentKey}-preamble-${part.start}`}
              {...rangeProps}
              contentKey={`${contentKey}-preamble-${part.start}`}
              rangeStart={part.start}
              rangeEnd={part.end}
            />
          );
        }

        const sectionBody = sectionBodyMarkdown(value, part);
        const precedingText = sectionPrecedingText(value, part);
        const sectionAnchorKey = `${contentKey}-section-${part.index}`;
        const hasHeadingRange = part.bodyStart > part.headingStart;

        return (
          <div
            key={sectionAnchorKey}
            data-studio-scroll-anchor={sectionAnchorKey}
            className="group/section w-full"
          >
            {hasHeadingRange ? (
              <div className="relative w-full">
                <StudioTextMarkdownRange
                  {...rangeProps}
                  contentKey={`${sectionAnchorKey}-heading`}
                  rangeStart={part.headingStart}
                  rangeEnd={part.bodyStart}
                  trimTrailingNewlines
                />
                <StudioTextSectionFrameActions
                  sectionBody={sectionBody}
                  precedingText={precedingText}
                  showEditHint={!readOnly}
                />
              </div>
            ) : null}
            <StudioTextMarkdownRange
              {...rangeProps}
              contentKey={`${sectionAnchorKey}-body`}
              rangeStart={part.bodyStart}
              rangeEnd={part.bodyEnd}
            />
          </div>
        );
      })}
    </div>
  );
}
