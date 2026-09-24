const NOISE = [
  /^\+\s+\S/,
  /^\++$/,
  /^Packages:/,
  /^Progress:/i,
  /^Already up to date/i,
  /^npm (?:notice|warn)\b/i,
  /^WARN\b/,
];

/** Drop package-install chatter so the 80-line log keeps real steps. */
export function isUpdateLogNoise(line) {
  const text = String(line).trim();
  if (!text) return true;
  return NOISE.some((pattern) => pattern.test(text));
}
