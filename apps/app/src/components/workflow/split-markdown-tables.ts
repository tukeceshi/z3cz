export interface TextSegment {
  readonly type: "text";
  readonly start: number;
  readonly end: number;
}

export interface TableSegment {
  readonly type: "table";
  readonly index: number;
  readonly start: number;
  readonly end: number;
}

export type MarkdownSegment = TextSegment | TableSegment;

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length >= 2 && trimmed.startsWith("|") && trimmed.endsWith("|");
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!isTableRow(trimmed)) {
    return false;
  }
  const inner = trimmed.slice(1, -1);
  return inner
    .split("|")
    .every((cell) => /^[\s:-]+$/.test(cell) && cell.includes("-"));
}

function buildLineStarts(markdown: string): readonly number[] {
  const lineStarts: number[] = [0];
  for (let i = 0; i < markdown.length; i++) {
    if (markdown[i] === "\n") {
      lineStarts.push(i + 1);
    }
  }
  return lineStarts;
}

export function splitMarkdownTables(markdown: string): MarkdownSegment[] {
  if (!markdown) {
    return [{ type: "text", start: 0, end: 0 }];
  }

  const lineStarts = buildLineStarts(markdown);
  const lineCount = lineStarts.length;
  const segments: MarkdownSegment[] = [];
  let tableIndex = 0;
  let cursor = 0;

  const getLine = (lineIdx: number): string => {
    const start = lineStarts[lineIdx] ?? 0;
    const end =
      lineIdx + 1 < lineCount
        ? (lineStarts[lineIdx + 1] ?? markdown.length) - 1
        : markdown.length;
    return markdown.slice(start, end);
  };

  let lineIdx = 0;

  while (lineIdx < lineCount) {
    const line = getLine(lineIdx);
    const nextLine = lineIdx + 1 < lineCount ? getLine(lineIdx + 1) : "";

    if (isTableRow(line) && isTableSeparator(nextLine)) {
      const tableStart = lineStarts[lineIdx] ?? 0;

      if (tableStart > cursor) {
        segments.push({ type: "text", start: cursor, end: tableStart });
      }

      let tableEndLine = lineIdx + 2;
      while (tableEndLine < lineCount && isTableRow(getLine(tableEndLine))) {
        tableEndLine++;
      }

      const tableEnd =
        tableEndLine < lineCount
          ? (lineStarts[tableEndLine] ?? markdown.length)
          : markdown.length;

      segments.push({
        type: "table",
        index: tableIndex,
        start: tableStart,
        end: tableEnd,
      });
      tableIndex++;

      cursor = tableEnd;
      lineIdx = tableEndLine;
      continue;
    }

    lineIdx++;
  }

  if (cursor < markdown.length) {
    segments.push({ type: "text", start: cursor, end: markdown.length });
  }

  if (segments.length === 0) {
    segments.push({ type: "text", start: 0, end: markdown.length });
  }

  return segments;
}

export function mergeMarkdownSegmentEdits(
  markdown: string,
  segments: readonly MarkdownSegment[],
  edits: {
    readonly textUpdates?: ReadonlyMap<string, string>;
    readonly tableUpdates?: ReadonlyMap<number, string>;
  }
): string {
  let result = "";
  for (const segment of segments) {
    if (segment.type === "table") {
      const original = markdown.slice(segment.start, segment.end);
      const updated = edits.tableUpdates?.get(segment.index);
      if (updated === undefined) {
        result += original;
        continue;
      }
      const originalBody = original.replace(/\n+$/, "");
      const trailingNewlines = original.slice(originalBody.length);
      const updatedBody = updated.replace(/\n+$/, "");
      result += updatedBody + trailingNewlines;
      continue;
    }

    const textKey = `${segment.start}:${segment.end}`;
    result +=
      edits.textUpdates?.get(textKey) ??
      markdown.slice(segment.start, segment.end);
  }
  return result;
}

export function textSegmentKey(segment: TextSegment): string {
  return `${segment.start}:${segment.end}`;
}

export function mergeMarkdownTableEdits(
  markdown: string,
  segments: readonly MarkdownSegment[],
  tableUpdates: ReadonlyMap<number, string>
): string {
  return mergeMarkdownSegmentEdits(markdown, segments, { tableUpdates });
}
