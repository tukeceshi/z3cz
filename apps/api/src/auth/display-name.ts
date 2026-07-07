export function deriveDisplayNameFromEmail(email: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  const localPart = normalizedEmail.split("@")[0]?.trim();
  return localPart && localPart.length > 0 ? localPart : normalizedEmail;
}
