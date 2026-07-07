/**
 * Generate local development secrets for apps/api/.dev.vars
 * Run once and store the output securely (never commit to version control).
 */

function generateHexKey(byteLength) {
  const keyBytes = new Uint8Array(byteLength);
  crypto.getRandomValues(keyBytes);
  return Array.from(keyBytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const secretMasterKey = generateHexKey(32);
const jwtSecret = generateHexKey(32);

console.log("Generated development secrets (store these securely):");
console.log("");
console.log(`SECRET_MASTER_KEY=${secretMasterKey}`);
console.log(`JWT_SECRET=${jwtSecret}`);
console.log("");
console.log("Add both lines to apps/api/.dev.vars");
console.log("");
console.log(
  "⚠️  IMPORTANT: Store these values securely and never commit them to version control!"
);
