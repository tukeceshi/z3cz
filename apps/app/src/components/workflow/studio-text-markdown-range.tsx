import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/utils/utils";
import type { KeyboardEvent, MouseEvent } from "react";

import {
  STUDIO_TEXT_PLAIN_SEGMENT,
  STUDIO_TEXT_PLAIN_SEGMENT_EDIT,
} from "./creative-studio-surface";
import { isStudioTextInlineEditorActive } from "./is-studio-text-inline-editor-active";
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
  readonly activeEditorKey: string | null;
  readonly onActivateEditor: (editorKey: string) => void;
  readonly trimTrailingNewlines?: boolean;
  readonly onFocus?: () => void;
  readonly onTextChange: (segmentKey: string, text: string) => void;
  readonly onTableChange: (
    tableIndex: number,
    tableMarkdown: string,
    originalTableMarkdown: string
  ) => void;
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

function activateEditorOnPointer(
  event: MouseEvent<HTMLElement>,
  activate: () => void
): void {
  if (event.button !== 0) {
    return;
  }
  event.preventDefault();
  activate();
}

function handleActivateKeyDown(
  event: KeyboardEvent<HTMLElement>,
  activate: () => void
): void {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }
  event.preventDefault();
  activate();
}

export function StudioTextMarkdownRange({
  value,
  rangeStart,
  rangeEnd,
  segments,
  readOnly,
  contentKey,
  activeEditorKey,
  onActivateEditor,
  trimTrailingNewlines = false,
  onFocus,
  onTextChange,
  onTableChange,
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
          const isEditingSegment = isStudioTextInlineEditorActive(
            readOnly,
            activeEditorKey,
            anchorKey
          );

          if (!isEditingSegment) {
            if (!visibleText && readOnly) {
              return null;
            }
            return (
              <div
                key={anchorKey}
                data-studio-scroll-anchor={anchorKey}
                className={cn(
                  STUDIO_TEXT_PLAIN_SEGMENT,
                  !readOnly && "cursor-text",
                  !visibleText && "min-h-[1.5em]"
                )}
                role={readOnly ? undefined : "button"}
                tabIndex={readOnly ? undefined : 0}
                onMouseDown={
                  readOnly
                    ? undefined
                    : (event) =>
                        activateEditorOnPointer(event, () => {
                          onActivateEditor(anchorKey);
                          onFocus?.();
                        })
                }
                onKeyDown={
                  readOnly
                    ? undefined
                    : (event) =>
                        handleActivateKeyDown(event, () => {
                          onActivateEditor(anchorKey);
                          onFocus?.();
                        })
                }
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
              autoFocus
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
        const isEditingTable = isStudioTextInlineEditorActive(
          readOnly,
          activeEditorKey,
          tableAnchorKey
        );

        if (!isEditingTable) {
          const handleActivateTable = () => {
            onActivateEditor(tableAnchorKey);
            onFocus?.();
          };

          return (
            <div
              key={tableAnchorKey}
              data-studio-scroll-anchor={tableAnchorKey}
              className={readOnly ? undefined : "cursor-text"}
              role={readOnly ? undefined : "button"}
              tabIndex={readOnly ? undefined : 0}
              onMouseDown={
                readOnly
                  ? undefined
                  : (event) => activateEditorOnPointer(event, handleActivateTable)
              }
              onKeyDown={
                readOnly
                  ? undefined
                  : (event) => handleActivateKeyDown(event, handleActivateTable)
              }
            >
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
