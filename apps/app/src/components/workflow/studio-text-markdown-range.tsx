import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/utils/utils";

import {
  STUDIO_TEXT_PLAIN_SEGMENT,
  STUDIO_TEXT_PLAIN_SEGMENT_EDIT,
} from "./creative-studio-surface";
import {
  textSegmentKey,
  type MarkdownSegment,
} from "./split-markdown-tables";
import { StudioTextMdxEditor } from "./studio-text-mdx-editor";
import { StudioTextTablePreview } from "./studio-text-table-preview";

export interface StudioTextMarkdownRangeProps {
  readonly value: string;
  readonly rangeStart: number;
  readonly rangeEnd: number;
  readonly segments: readonly MarkdownSegment[];
  readonly readOnly: boolean;
  readonly contentKey: string;
  readonly trimTrailingNewlines?: boolean;
  readonly onFocus?: () => void;
  readonly onTextChange: (segmentKey: string, text: string) => void;
  readonly onTableChange: (
    tableIndex: number,
    tableMarkdown: string,
    originalTableMarkdown: string
  ) => void;
  readonly onContainerBlur: () => void;
  readonly onLayoutUpdated?: () => void;
}

function segmentsOverlappingRange(
  segments: readonly MarkdownSegment[],
  rangeStart: number,
  rangeEnd: number
): readonly MarkdownSegment[] {
  return segments.filter(
    (segment) => segment.end > rangeStart && segment.start < rangeEnd
  );
}

function displayPlainText(raw: string, trimTrailingNewlines: boolean): string {
  if (!trimTrailingNewlines) {
    return raw;
  }
  return raw.replace(/\n+$/, "");
}

export function StudioTextMarkdownRange({
  value,
  rangeStart,
  rangeEnd,
  segments,
  readOnly,
  contentKey,
  trimTrailingNewlines = false,
  onFocus,
  onTextChange,
  onTableChange,
  onContainerBlur,
  onLayoutUpdated,
}: StudioTextMarkdownRangeProps) {
  const overlapping = segmentsOverlappingRange(segments, rangeStart, rangeEnd);

  return (
    <>
      {overlapping.map((segment) => {
        if (segment.type === "text") {
          const clipStart = Math.max(segment.start, rangeStart);
          const clipEnd = Math.min(segment.end, rangeEnd);
          if (clipStart >= clipEnd) {
            return null;
          }

          const segmentKey = textSegmentKey(segment);
          const anchorKey = `${contentKey}-${segmentKey}`;
          const prefix = value.slice(segment.start, clipStart);
          const suffix = value.slice(clipEnd, segment.end);
          const visibleText = displayPlainText(
            value.slice(clipStart, clipEnd),
            trimTrailingNewlines
          );

          if (readOnly) {
            if (!visibleText) {
              return null;
            }
            return (
              <div
                key={anchorKey}
                data-studio-scroll-anchor={anchorKey}
                className={STUDIO_TEXT_PLAIN_SEGMENT}
              >
                {visibleText}
              </div>
            );
          }

          return (
            <Textarea
              key={anchorKey}
              data-studio-scroll-anchor={anchorKey}
              value={visibleText}
              onChange={(event) =>
                onTextChange(
                  segmentKey,
                  prefix + event.target.value + suffix
                )
              }
              onFocus={onFocus}
              className={cn(
                STUDIO_TEXT_PLAIN_SEGMENT,
                STUDIO_TEXT_PLAIN_SEGMENT_EDIT
              )}
            />
          );
        }

        if (segment.start < rangeStart || segment.end > rangeEnd) {
          return null;
        }

        const tableMarkdown = value.slice(segment.start, segment.end);
        const tableAnchorKey = `${contentKey}-table-${segment.index}`;

        if (readOnly) {
          return (
            <div key={tableAnchorKey} data-studio-scroll-anchor={tableAnchorKey}>
              <StudioTextTablePreview markdown={tableMarkdown} />
            </div>
          );
        }

        return (
          <div key={tableAnchorKey} data-studio-scroll-anchor={tableAnchorKey}>
            <StudioTextMdxEditor
              value={tableMarkdown}
              onChange={(markdown) =>
                onTableChange(segment.index, markdown, tableMarkdown)
              }
              onBlur={onContainerBlur}
              readOnly={false}
              contentKey={`${contentKey}-table-${segment.index}`}
              onLayoutUpdated={onLayoutUpdated}
            />
          </div>
        );
      })}
    </>
  );
}
