/**
 * Non-login form inputs that must not trigger browser or password-manager autofill.
 *
 * Use `CredentialPlainInput` for text-like fields (API keys, hostnames, config values).
 * Use `CredentialSecretInput` for secrets (masks with dots; never use `type="password"`).
 *
 * Also set `autoComplete="off"` on the parent `<form>` and use semantic `name` values
 * (e.g. `auth_config_smtp_host`), not `email` / `username` / `password`.
 *
 * Reference: `volcano-credential-fields.tsx`, `admin-login-methods-page.tsx`
 */
import type { InputHTMLAttributes } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/utils/utils";

export const secretKeyMaskClassName =
  "[-webkit-text-security:disc] [text-security:disc]";

export const credentialAutofillIgnoreProps = {
  autoComplete: "off",
  "data-1p-ignore": true,
  "data-lpignore": "true",
} as const satisfies InputHTMLAttributes<HTMLInputElement>;

type CredentialInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "autoComplete"
>;

export function CredentialPlainInput({
  className,
  ...props
}: CredentialInputProps) {
  return (
    <Input
      type="text"
      className={className}
      {...credentialAutofillIgnoreProps}
      {...props}
    />
  );
}

export function CredentialSecretInput({
  className,
  ...props
}: CredentialInputProps) {
  return (
    <CredentialPlainInput
      className={cn(secretKeyMaskClassName, className)}
      {...props}
    />
  );
}
