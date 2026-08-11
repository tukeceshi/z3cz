export interface MarkdownPreamble {
  readonly type: "preamble";
  readonly start: number;
  readonly end: number;
}

export interface MarkdownHeadingSection {
  readonly type: "section";
  readonly index: number;
  readonly level: number;
  readonly start: number;
  readonly end: number;
  readonly headingStart: number;
  readonly headingEnd: number;
  readonly bodyStart: number;
  readonly bodyEnd: number;
}

export type MarkdownSectionPart = MarkdownPreamble | MarkdownHeadingSection;

interface MarkdownHeading {
  readonly lineIndex: number;
  readonly level: number;
  readonly headingStart: number;
  readonly headingEnd: number;
}

function buildLineStarts(markdown: string): readonly number[] {
  const lineStarts: number[] = [0];
  for (let index = 0; index < markdown.length; index += 1) {
    if (markdown[index] === "\n") {
      lineStarts.push(index + 1);
    }
  }
  return lineStarts;
}

function readLine(
  markdown: string,
  lineStarts: readonly number[],
  lineIndex: number
): string {
  const lineCount = lineStarts.length;
  const start = lineStarts[lineIndex] ?? 0;
  const end =
    lineIndex + 1 < lineCount
      ? (lineStarts[lineIndex + 1] ?? markdown.length) - 1
      : markdown.length;
  return markdown.slice(start, end);
}

/** Line-start H2–H6 (`##` … `######`, not H1 or H7+). */
export function parseMarkdownHeadingLevel(line: string): number | null {
  const match = /^(#{2,6}) (?!#)/.exec(line);
  return match ? match[1]!.length : null;
}

function parseMarkdownHeadings(
  markdown: string,
  lineStarts: readonly number[]
): MarkdownHeading[] {
  const lineCount = lineStarts.length;
  const headings: MarkdownHeading[] = [];

  for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
    const line = readLine(markdown, lineStarts, lineIndex);
    const level = parseMarkdownHeadingLevel(line);
    if (level === null) {
      continue;
    }

    headings.push({
      lineIndex,
      level,
      headingStart: lineStarts[lineIndex] ?? 0,
      headingEnd:
        lineIndex + 1 < lineCount
          ? (lineStarts[lineIndex + 1] ?? markdown.length)
          : markdown.length,
    });
  }

  return headings;
}

function isLeafHeading(
  headings: readonly MarkdownHeading[],
  index: number
): boolean {
  const current = headings[index]!;
  let nextBoundaryIndex = headings.length;

  for (let candidate = index + 1; candidate < headings.length; candidate += 1) {
    if (headings[candidate]!.level <= current.level) {
      nextBoundaryIndex = candidate;
      break;
    }
  }

  for (let candidate = index + 1; candidate < nextBoundaryIndex; candidate += 1) {
    if (headings[candidate]!.level > current.level) {
      return false;
    }
  }

  return true;
}

function sectionEndForHeading(
  markdown: string,
  headings: readonly MarkdownHeading[],
  index: number
): number {
  const current = headings[index]!;

  for (let candidate = index + 1; candidate < headings.length; candidate += 1) {
    if (headings[candidate]!.level <= current.level) {
      return headings[candidate]!.headingStart;
    }
  }

  return markdown.length;
}

/**
 * Split markdown into non-trigger ranges (preamble) and leaf-heading sections.
 * Only the deepest heading in each outline branch triggers create-node.
 */
export function splitMarkdownSections(
  markdown: string
): readonly MarkdownSectionPart[] {
  if (!markdown) {
    return [{ type: "preamble", start: 0, end: 0 }];
  }

  const lineStarts = buildLineStarts(markdown);
  const headings = parseMarkdownHeadings(markdown, lineStarts);
  const leafHeadings = headings.filter((_, index) =>
    isLeafHeading(headings, index)
  );

  if (leafHeadings.length === 0) {
    return [{ type: "preamble", start: 0, end: markdown.length }];
  }

  const parts: MarkdownSectionPart[] = [];
  let cursor = 0;
  let sectionIndex = 0;

  for (let leafIndex = 0; leafIndex < leafHeadings.length; leafIndex += 1) {
    const leaf = leafHeadings[leafIndex]!;
    if (cursor < leaf.headingStart) {
      parts.push({ type: "preamble", start: cursor, end: leaf.headingStart });
    }

    const headingIndex = headings.findIndex(
      (heading) => heading.headingStart === leaf.headingStart
    );
    const bodyEnd = sectionEndForHeading(markdown, headings, headingIndex);

    parts.push({
      type: "section",
      index: sectionIndex,
      level: leaf.level,
      start: leaf.headingStart,
      end: bodyEnd,
      headingStart: leaf.headingStart,
      headingEnd: leaf.headingEnd,
      bodyStart: leaf.headingEnd,
      bodyEnd,
    });

    sectionIndex += 1;
    cursor = bodyEnd;
  }

  if (cursor < markdown.length) {
    parts.push({ type: "preamble", start: cursor, end: markdown.length });
  }

  return parts;
}

export function sectionBodyMarkdown(
  markdown: string,
  section: MarkdownHeadingSection
): string {
  return markdown.slice(section.bodyStart, section.bodyEnd);
}

export function sectionPrecedingText(
  markdown: string,
  section: MarkdownHeadingSection
): string {
  return markdown.slice(0, section.bodyStart);
}
