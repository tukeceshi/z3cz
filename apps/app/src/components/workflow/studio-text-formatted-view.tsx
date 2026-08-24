import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "@/utils/utils";
import {
  sectionBodyMarkdown,
  sectionContentRanges,
  sectionHeadingDisplayText,
  sectionPrecedingText,
  splitMarkdownSections,
} from "./split-markdown-sections";
import {
  mergeMarkdownSegmentEdits,
  splitMarkdownTables,
} from "./split-markdown-tables";
import { patchMarkdownTableEdit } from "./patch-markdown-table-edit";
import { StudioTextMarkdownRange } from "./studio-text-markdown-range";
import { StudioTextSectionFrameActions } from "./studio-text-section-frame-actions";

export interface StudioTextFormattedViewProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onFocus?: () => void;
  readonly readOnly: boolean;
  readonly contentKey: string;
  readonly onLayoutUpdated?: () => void;
  readonly className?: string;
}

export function StudioTextFormattedView({
  value,
  onChange,
  onFocus,
  readOnly,
  contentKey,
  onLayoutUpdated,
  className,
}: StudioTextFormattedViewProps) {
  const [activeEditorKey, setActiveEditorKey] = useState<string | null>(null);
  const sections = useMemo(() => splitMarkdownSections(value), [value]);
  const segments = useMemo(() => splitMarkdownTables(value), [value]);

  useEffect(() => {
    if (readOnly) {
      setActiveEditorKey(null);
    }
  }, [readOnly]);

  const handleActivateEditor = useCallback((editorKey: string) => {
    setActiveEditorKey(editorKey);
  }, []);

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

  const rangeProps = {
    value,
    segments,
    readOnly,
    activeEditorKey,
    onActivateEditor: handleActivateEditor,
    onFocus,
    onTextChange: handleTextChange,
    onTableChange: handleTableChange,
    onLayoutUpdated,
  };

  return (
    <div className={cn("min-h-full p-3", className)}>
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
        const headingText = sectionHeadingDisplayText(value, part);
        const sectionAnchorKey = `${contentKey}-section-${part.index}`;
        const contentRanges = sectionContentRanges(part);

        return (
          <div
            key={sectionAnchorKey}
            data-studio-scroll-anchor={sectionAnchorKey}
            className="group/section relative w-full"
          >
            {contentRanges.map((range) => (
              <StudioTextMarkdownRange
                key={`${sectionAnchorKey}-${range.key}`}
                {...rangeProps}
                contentKey={`${sectionAnchorKey}-${range.key}`}
                rangeStart={range.start}
                rangeEnd={range.end}
                trimTrailingNewlines={range.trimTrailingNewlines}
              />
            ))}
            {headingText ? (
              <StudioTextSectionFrameActions
                sectionBody={sectionBody}
                precedingText={precedingText}
                headingText={headingText}
                showEditHint={!readOnly}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
