export interface ParsedMarkdownTable {
  readonly header: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

export function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length >= 2 && trimmed.startsWith("|") && trimmed.endsWith("|");
}

export function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!isTableRow(trimmed)) {
    return false;
  }
  const inner = trimmed.slice(1, -1);
  return inner
    .split("|")
    .every((cell) => /^[\s:-]+$/.test(cell) && cell.includes("-"));
}

export function parseTableRow(line: string): readonly string[] | null {
  const trimmed = line.trim();
  if (!isTableRow(trimmed)) {
    return null;
  }
  return trimmed.slice(1, -1).split("|");
}

export function parseMarkdownTableRows(
  markdown: string
): ParsedMarkdownTable | null {
  const lines = markdown.replace(/\n+$/, "").split("\n");
  if (lines.length < 2) {
    return null;
  }

  const headerLine = lines[0];
  const separatorLine = lines[1];
  if (
    headerLine === undefined ||
    separatorLine === undefined ||
    !isTableRow(headerLine) ||
    !isTableSeparator(separatorLine)
  ) {
    return null;
  }

  const header = parseTableRow(headerLine);
  if (!header) {
    return null;
  }

  const rows: string[][] = [];
  for (let index = 2; index < lines.length; index++) {
    const line = lines[index];
    if (line === undefined || !isTableRow(line) || isTableSeparator(line)) {
      continue;
    }
    const cells = parseTableRow(line);
    if (cells) {
      rows.push([...cells]);
    }
  }

  return { header, rows };
}

export function buildTableRow(cells: readonly string[]): string {
  return `|${cells.join("|")}|`;
}
