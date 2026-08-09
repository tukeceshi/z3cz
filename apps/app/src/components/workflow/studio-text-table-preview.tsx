import { useMemo } from "react";

import { cn } from "@/utils/utils";

import { parseMarkdownTableRows } from "./parse-markdown-table";
import { StudioTextTableBoundary } from "./studio-text-table-boundary";
import { StudioTextTableFrameActions } from "./studio-text-table-frame-actions";

export interface StudioTextTablePreviewProps {
  readonly markdown: string;
  readonly precedingText?: string;
  readonly followsText?: boolean;
  readonly className?: string;
}

export function StudioTextTablePreview({
  markdown,
  precedingText = "",
  followsText = false,
  className,
}: StudioTextTablePreviewProps) {
  const parsed = useMemo(() => parseMarkdownTableRows(markdown), [markdown]);

  if (!parsed) {
    return (
      <StudioTextTableBoundary followsText={followsText} mode="preview">
        <div className="group/table">
          <div className="relative w-full">
            <StudioTextTableFrameActions
              tableMarkdown={markdown}
              precedingText={precedingText}
            />
            <div
              className={cn(
                "studio-mdx-table-frame pointer-events-none select-none",
                className
              )}
            >
              <div className="studio-mdx-editor">
                <pre className="studio-text-mdx-body whitespace-pre-wrap break-words p-3 text-sm">
                  {markdown}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </StudioTextTableBoundary>
    );
  }

  return (
    <StudioTextTableBoundary followsText={followsText} mode="preview">
      <div className="group/table">
        <div className="relative w-full">
          <StudioTextTableFrameActions
            tableMarkdown={markdown}
            precedingText={precedingText}
          />
          <div
            className={cn(
              "studio-mdx-table-frame pointer-events-none select-none",
              className
            )}
          >
            <div className="studio-mdx-editor border-0 bg-transparent shadow-none">
              <table>
                <tbody>
                  <tr>
                    {parsed.header.map((cell, columnIndex) => (
                      <th key={`header-${columnIndex}`}>{cell.trim()}</th>
                    ))}
                  </tr>
                  {parsed.rows.map((row, rowIndex) => (
                    <tr key={`row-${rowIndex}`}>
                      {row.map((cell, columnIndex) => (
                        <td key={`cell-${rowIndex}-${columnIndex}`}>
                          {cell.trim()}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </StudioTextTableBoundary>
  );
}
