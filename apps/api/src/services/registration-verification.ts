import type { Bindings } from "../context";

const REGISTRATION_CODE_TTL_SECONDS = 600;
const REGISTRATION_CODE_PREFIX = "reg-verify:";

function registrationCodeKey(email: string): string {
  return `${REGISTRATION_CODE_PREFIX}${email.trim().toLowerCase}`;
}

export function generateRegistrationVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function storeRegistrationVerificationCode(
  env: Bindings,
  email: string,
  code: string
): Promise<void> {
  await env.KV.put(registrationCodeKey(email), code, {
    expirationTtl: REGISTRATION_CODE_TTL_SECONDS,
  });
}

export async function verifyRegistrationVerificationCode(
  env: Bindings,
  email: string,
  code: string
): Promise<boolean> {
  const stored = await env.KV.get(registrationCodeKey(email));
  if (!stored || stored !== code.trim()) {
    return false;
  }

  await env.KV.delete(registrationCodeKey(email));
  return true;
}

export const REGISTRATION_CODE_RESEND_COOLDOWN_SECONDS = 60;

export async function getRegistrationCodeCooldownRemaining(
  env: Bindings,
  email: string
): Promise<number> {
  const cooldownKey = `${registrationCodeKey(email)}:cooldown`;
  const value = await env.KV.get(cooldownKey);
  if (!value) {
    return 0;
  }

  const expiresAt = Number.parseInt(value, 10);
  const remainingMs = expiresAt - Date.now();
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

export async function markRegistrationCodeSent(
  env: Bindings,
  email: string
): Promise<void> {
  const cooldownKey = `${registrationCodeKey(email)}:cooldown`;
  await env.KV.put(
    cooldownKey,
    (Date.now() + REGISTRATION_CODE_RESEND_COOLDOWN_SECONDS * 1000).toString(),
    { expirationTtl: REGISTRATION_CODE_RESEND_COOLDOWN_SECONDS }
  );
}
