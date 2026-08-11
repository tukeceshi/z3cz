import type { TextEditOp } from "@dafthunk/types";

export async function sha256HexFromText(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function longestCommonPrefixBytes(
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
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const oldBytes = encoder.encode(oldText);
  const newBytes = encoder.encode(newText);
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
  const replaceText = decoder.decode(
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

export function applyTextEditOps(
  baseText: string,
  ops: readonly TextEditOp[]
): string {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let bytes = encoder.encode(baseText);
  for (const op of ops) {
    if (op.op === "append") {
      const appendBytes = encoder.encode(op.text);
      const next = new Uint8Array(bytes.length + appendBytes.length);
      next.set(bytes);
      next.set(appendBytes, bytes.length);
      bytes = next;
      continue;
    }

    const before = bytes.slice(0, op.start);
    const after = bytes.slice(op.end);
    const replaceBytes = encoder.encode(op.text);
    const next = new Uint8Array(
      before.length + replaceBytes.length + after.length
    );
    next.set(before);
    next.set(replaceBytes, before.length);
    next.set(after, before.length + replaceBytes.length);
    bytes = next;
  }
  return decoder.decode(bytes);
}
