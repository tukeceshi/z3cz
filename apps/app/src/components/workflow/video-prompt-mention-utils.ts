import { VIDEO_PROMPT_REF_TOKEN_PATTERN } from "./video-prompt-compile";

const MENTION_TAIL_PATTERN = /@([^\s@]*)$/;
export const PROMPT_REF_FLAT_PLACEHOLDER = "\uFFFC";

export interface DetectedMention {
  readonly query: string;
  readonly mentionStartStored: number;
  readonly mentionEndStored: number;
  readonly mentionStartFlat: number;
  readonly mentionEndFlat: number;
}

export function storedToFlatText(stored: string): string {
  return stored.replace(VIDEO_PROMPT_REF_TOKEN_PATTERN, PROMPT_REF_FLAT_PLACEHOLDER);
}

export function flatIndexToStoredIndex(stored: string, flatIndex: number): number {
  const pattern = new RegExp(VIDEO_PROMPT_REF_TOKEN_PATTERN.source, "g");
  let flatPos = 0;
  let lastIndex = 0;

  for (const match of stored.matchAll(pattern)) {
    const tokenStart = match.index ?? 0;
    const textLength = tokenStart - lastIndex;

    if (flatIndex <= flatPos + textLength) {
      return lastIndex + (flatIndex - flatPos);
    }

    flatPos += textLength;

    if (flatIndex <= flatPos + 1) {
      return tokenStart + match[0].length;
    }

    flatPos += 1;
    lastIndex = tokenStart + match[0].length;
  }

  return lastIndex + (flatIndex - flatPos);
}

export function resolveEffectiveFlatCaretIndex(
  flatText: string,
  caretIndexFlat: number
): number {
  const clamped = Math.min(Math.max(0, caretIndexFlat), flatText.length);
  if (clamped > 0) {
    return clamped;
  }

  if (flatText.length === 0) {
    return 0;
  }

  const tailMatch = flatText.match(MENTION_TAIL_PATTERN);
  if (tailMatch && flatText.endsWith(tailMatch[0])) {
    return flatText.length;
  }

  return 0;
}

export function detectMention(
  stored: string,
  caretIndexFlat: number
): DetectedMention | null {
  const flatText = storedToFlatText(stored);
  const effectiveCaret = resolveEffectiveFlatCaretIndex(flatText, caretIndexFlat);
  const before = flatText.slice(0, effectiveCaret);
  const match = before.match(MENTION_TAIL_PATTERN);
  if (!match) {
    return null;
  }

  const mentionStartFlat = before.length - match[0].length;
  const mentionEndFlat = effectiveCaret;

  return {
    query: match[1] ?? "",
    mentionStartStored: flatIndexToStoredIndex(stored, mentionStartFlat),
    mentionEndStored: flatIndexToStoredIndex(stored, mentionEndFlat),
    mentionStartFlat,
    mentionEndFlat,
  };
}

export function applyMentionPick(
  stored: string,
  mentionStartStored: number,
  mentionEndStored: number,
  edgeId: string
): string {
  return (
    stored.slice(0, mentionStartStored) +
    `{{ref:${edgeId}}}` +
    stored.slice(mentionEndStored)
  );
}

export function flattenDomToFlatText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }
  if (!(node instanceof HTMLElement)) return "";
  if (node.dataset.refEdgeId) {
    return PROMPT_REF_FLAT_PLACEHOLDER;
  }
  if (node.tagName === "BR") {
    return "\n";
  }
  let text = "";
  for (const child of node.childNodes) {
    text += flattenDomToFlatText(child);
  }
  return text;
}

export function domRangeToFlatIndex(root: HTMLElement, range: Range): number {
  const preRange = document.createRange();
  preRange.selectNodeContents(root);
  preRange.setEnd(range.startContainer, range.startOffset);
  return flattenDomToFlatText(preRange.cloneContents()).length;
}

function readRangeCaretRect(range: Range): DOMRect | null {
  const clientRects = range.getClientRects();
  if (clientRects.length > 0) {
    return clientRects[clientRects.length - 1] ?? null;
  }

  const rect = range.getBoundingClientRect();
  if (rect.width > 0 || rect.height > 0) {
    return rect;
  }

  return null;
}

export function flatIndexToCaretRect(
  root: HTMLElement,
  flatIndex: number
): DOMRect | null {
  const range = flatIndexToDomRange(root, flatIndex);
  if (!range) {
    return null;
  }

  return readRangeCaretRect(range);
}

export function resolveMentionPickerAnchor(
  root: HTMLElement,
  mentionEndFlat: number
): DOMRect {
  const selection = window.getSelection();
  if (
    selection &&
    selection.rangeCount > 0 &&
    selection.isCollapsed &&
    root.contains(selection.anchorNode)
  ) {
    const selectionRect = readRangeCaretRect(selection.getRangeAt(0));
    if (selectionRect) {
      return selectionRect;
    }
  }

  const flatRect = flatIndexToCaretRect(root, mentionEndFlat);
  if (flatRect) {
    return flatRect;
  }

  const flatStartRect = flatIndexToCaretRect(root, Math.max(0, mentionEndFlat - 1));
  if (flatStartRect) {
    return flatStartRect;
  }

  const rootRect = root.getBoundingClientRect();
  return new DOMRect(rootRect.left + 8, rootRect.top + 8, 0, 0);
}

function flatIndexToDomRange(root: HTMLElement, flatIndex: number): Range | null {
  let charIndex = 0;

  const visit = (node: Node): Range | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node as Text;
      const text = textNode.data;
      const nodeStart = charIndex;
      const nodeEnd = charIndex + text.length;

      if (flatIndex >= nodeStart && flatIndex <= nodeEnd) {
        const range = document.createRange();
        range.setStart(textNode, Math.min(flatIndex - nodeStart, text.length));
        range.collapse(true);
        return range;
      }

      charIndex = nodeEnd;
      return null;
    }

    if (node instanceof HTMLElement && node.dataset.refEdgeId) {
      const nodeStart = charIndex;
      const nodeEnd = charIndex + 1;

      if (flatIndex >= nodeStart && flatIndex <= nodeEnd) {
        const range = document.createRange();
        if (flatIndex <= nodeStart) {
          range.setStartBefore(node);
        } else {
          range.setStartAfter(node);
        }
        range.collapse(true);
        return range;
      }

      charIndex = nodeEnd;
      return null;
    }

    if (node instanceof HTMLElement && node.tagName === "BR") {
      const nodeStart = charIndex;
      const nodeEnd = charIndex + 1;
      if (flatIndex >= nodeStart && flatIndex <= nodeEnd) {
        const range = document.createRange();
        range.setStartBefore(node);
        range.collapse(true);
        return range;
      }
      charIndex = nodeEnd;
      return null;
    }

    for (const child of node.childNodes) {
      const range = visit(child);
      if (range) {
        return range;
      }
    }
    return null;
  };

  return visit(root);
}

export function setDomCaretToFlatIndex(
  root: HTMLElement,
  flatIndex: number
): boolean {
  const range = flatIndexToDomRange(root, flatIndex);
  if (!range) {
    return false;
  }

  const selection = window.getSelection();
  if (!selection) {
    return false;
  }

  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}
