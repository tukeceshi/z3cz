/**
 * Semantic version compare for GitHub Release tags.
 * Informal labels (latest, sha-*) are always older than a real vX.Y.Z.
 */

/**
 * @param {string} raw
 * @returns {{ major: number, minor: number, patch: number, pre: string[] } | null}
 */
export function parseVersion(raw) {
  let value = String(raw ?? "").trim();
  if (!value) {
    return null;
  }
  if (value.startsWith("v") || value.startsWith("V")) {
    value = value.slice(1);
  }
  value = value.split("+", 2)[0] ?? value;
  const [core, preRaw] = value.split("-", 2);
  const parts = (core ?? "").split(".");
  if (parts.length < 3) {
    return null;
  }
  const major = Number(parts[0]);
  const minor = Number(parts[1]);
  const patch = Number(parts[2]);
  if (![major, minor, patch].every((n) => Number.isInteger(n) && n >= 0)) {
    return null;
  }
  if (parts.length > 3) {
    return null;
  }
  const pre = preRaw ? preRaw.split(".") : [];
  return { major, minor, patch, pre };
}

/**
 * @param {string} raw
 */
export function isReleaseVersion(raw) {
  return parseVersion(raw) !== null;
}

/**
 * @param {string} raw
 */
export function displayVersion(raw) {
  const value = String(raw ?? "").trim();
  if (!value) {
    return "";
  }
  if (isReleaseVersion(value) && !value.startsWith("v") && !value.startsWith("V")) {
    return `v${value}`;
  }
  return value;
}

/**
 * @param {string} raw
 */
export function dockerImageTag(raw) {
  const value = String(raw ?? "").trim();
  if (!value) {
    return "latest";
  }
  if (value.startsWith("v") || value.startsWith("V")) {
    return value.slice(1);
  }
  return value;
}

/**
 * @param {string} left
 * @param {string} right
 */
export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (a && b) {
    return compareParsed(a, b);
  }
  if (!a && b) {
    return -1;
  }
  if (a && !b) {
    return 1;
  }
  return String(left ?? "").trim().localeCompare(String(right ?? "").trim());
}

/**
 * @param {{ major: number, minor: number, patch: number, pre: string[] }} a
 * @param {{ major: number, minor: number, patch: number, pre: string[] }} b
 */
function compareParsed(a, b) {
  for (const pair of [
    [a.major, b.major],
    [a.minor, b.minor],
    [a.patch, b.patch],
  ]) {
    if (pair[0] < pair[1]) {
      return -1;
    }
    if (pair[0] > pair[1]) {
      return 1;
    }
  }
  if (a.pre.length === 0 && b.pre.length > 0) {
    return 1;
  }
  if (a.pre.length > 0 && b.pre.length === 0) {
    return -1;
  }
  const n = Math.max(a.pre.length, b.pre.length);
  for (let i = 0; i < n; i += 1) {
    if (i >= a.pre.length) {
      return -1;
    }
    if (i >= b.pre.length) {
      return 1;
    }
    const an = Number(a.pre[i]);
    const bn = Number(b.pre[i]);
    const aNum = Number.isInteger(an);
    const bNum = Number.isInteger(bn);
    if (aNum && bNum && an !== bn) {
      return an < bn ? -1 : 1;
    }
    if (aNum && !bNum) {
      return -1;
    }
    if (!aNum && bNum) {
      return 1;
    }
    if (a.pre[i] !== b.pre[i]) {
      return a.pre[i] < b.pre[i] ? -1 : 1;
    }
  }
  return 0;
}
