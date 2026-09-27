export function readSiteAddressSetting(
  env: Readonly<Record<string, string | undefined>>,
  name: "SITE_ADDRESS_SOCKET" | "SITE_ADDRESS_TOKEN"
): string | undefined {
  const direct = env[name]?.trim();
  if (direct) {
    return direct;
  }
  const prefixed = env[`Z3CZ_${name}`]?.trim();
  return prefixed || undefined;
}
