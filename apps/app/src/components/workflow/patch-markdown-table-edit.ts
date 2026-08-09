import {
  buildTableRow,
  isTableRow,
  isTableSeparator,
  parseTableRow,
} from "./parse-markdown-table";

function mergeTableRow(originalLine: string, editedLine: string): string {
  if (isTableSeparator(originalLine)) {
    return originalLine;
  }

  const originalCells = parseTableRow(originalLine);
  const editedCells = parseTableRow(editedLine);

  if (!originalCells || !editedCells) {
    return originalLine;
  }

  if (originalCells.length !== editedCells.length) {
    return editedLine;
  }

  const mergedCells = originalCells.map((originalCell, index) => {
    const editedCell = editedCells[index] ?? "";
    if (editedCell.trim() === originalCell.trim()) {
      return originalCell;
    }
    return editedCell.trim();
  });

  return buildTableRow(mergedCells);
}

export function patchMarkdownTableEdit(
  original: string,
  edited: string
): string {
  const originalBody = original.replace(/\n+$/, "");
  const editedBody = edited.replace(/\n+$/, "");
  const trailingNewlines = original.slice(originalBody.length) || "\n";

  const originalLines = originalBody.split("\n");
  const editedLines = editedBody.split("\n");
  const lineCount = Math.max(originalLines.length, editedLines.length);
  const result: string[] = [];

  for (let index = 0; index < lineCount; index++) {
    const originalLine = originalLines[index];
    const editedLine = editedLines[index];

    if (originalLine === undefined) {
      if (editedLine !== undefined) {
        result.push(editedLine);
      }
      continue;
    }

    if (editedLine === undefined) {
      result.push(originalLine);
      continue;
    }

    result.push(mergeTableRow(originalLine, editedLine));
  }

  return `${result.join("\n")}${trailingNewlines}`;
}
