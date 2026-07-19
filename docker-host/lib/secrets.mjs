import crypto from "node:crypto";

/**
 * @param {number} byteLength
 */
export function generateHexSecret(byteLength = 32) {
  return crypto.randomBytes(byteLength).toString("hex");
}

/**
 * @param {string | undefined} value
 */
export function isPlaceholderSecret(value) {
  if (!value) {
    return true;
  }
  if (value === "CHANGE_ME" || value === "change-me") {
    return true;
  }
  if (value.startsWith("change-me")) {
    return true;
  }
  if (value.startsWith("dev-insecure-")) {
    return true;
  }
  return false;
}
