import { useMemo } from "react";

import { cn } from "@/utils/utils";

import { normalizeTableMarkdownForDisplay } from "./normalize-table-markdown-for-display";
import { parseMarkdownTableRows } from "./parse-markdown-table";

export interface StudioTextTablePreviewProps {
  readonly markdown: string;
  readonly className?: string;
}

export function StudioTextTablePreview({
  markdown,
  className,
}: StudioTextTablePreviewProps) {
  const parsed = useMemo(
    () => parseMarkdownTableRows(normalizeTableMarkdownForDisplay(markdown)),
    [markdown]
  );

  if (!parsed) {
    return (
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
    );
  }

  return (
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
  );
}
