import { createHash } from "node:crypto";

import type { TextEditOp } from "@dafthunk/types";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function sha256HexFromBytes(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

export function sha256HexFromText(text: string): string {
  return sha256HexFromBytes(textEncoder.encode(text));
}

export function applyTextEditOps(
  base: Uint8Array,
  ops: readonly TextEditOp[]
): Uint8Array {
  let current = base;
  for (const op of ops) {
    if (op.op === "append") {
      const appendBytes = textEncoder.encode(op.text);
      const next = new Uint8Array(current.length + appendBytes.length);
      next.set(current);
      next.set(appendBytes, current.length);
      current = next;
      continue;
    }

    const before = current.slice(0, op.start);
    const after = current.slice(op.end);
    const replaceBytes = textEncoder.encode(op.text);
    const next = new Uint8Array(
      before.length + replaceBytes.length + after.length
    );
    next.set(before);
    next.set(replaceBytes, before.length);
    next.set(after, before.length + replaceBytes.length);
    current = next;
  }
  return current;
}

export function decodeUtf8(bytes: Uint8Array): string {
  return textDecoder.decode(bytes);
}

export function longestCommonPrefixBytes(
  left: Uint8Array,
  right: Uint8Array
): number {
  const limit = Math.min(left.length, right.length);
  let index = 0;
  while (index < limit && left[index] === right[index]) {
    index += 1;
  }
  return index;
}

export function diffTextToOps(oldText: string, newText: string): TextEditOp[] {
  const oldBytes = textEncoder.encode(oldText);
  const newBytes = textEncoder.encode(newText);
  const prefixLen = longestCommonPrefixBytes(oldBytes, newBytes);

  let suffixLen = 0;
  while (
    suffixLen < oldBytes.length - prefixLen &&
    suffixLen < newBytes.length - prefixLen &&
    oldBytes[oldBytes.length - 1 - suffixLen] ===
      newBytes[newBytes.length - 1 - suffixLen]
  ) {
    suffixLen += 1;
  }

  const replaceStart = prefixLen;
  const replaceEnd = oldBytes.length - suffixLen;
  const replaceText = textDecoder.decode(
    newBytes.slice(prefixLen, newBytes.length - suffixLen)
  );

  if (replaceStart === replaceEnd && replaceText.length === 0) {
    return [];
  }

  if (replaceStart === 0 && replaceEnd === oldBytes.length) {
    return [{ op: "replace", start: 0, end: oldBytes.length, text: newText }];
  }

  if (replaceEnd === replaceStart) {
    return [{ op: "append", text: replaceText }];
  }

  return [
    { op: "replace", start: replaceStart, end: replaceEnd, text: replaceText },
  ];
}

export function syncOpsFromBaseToPending(
  baseBytes: Uint8Array,
  pendingBytes: Uint8Array
): TextEditOp[] {
  const prefixLen = longestCommonPrefixBytes(baseBytes, pendingBytes);
  if (prefixLen === baseBytes.length) {
    const appendText = textDecoder.decode(pendingBytes.slice(prefixLen));
    return appendText.length > 0 ? [{ op: "append", text: appendText }] : [];
  }

  const pendingText = textDecoder.decode(pendingBytes);
  return [
    {
      op: "replace",
      start: prefixLen,
      end: baseBytes.length,
      text: textDecoder.decode(pendingBytes.slice(prefixLen)),
    },
  ];
}
