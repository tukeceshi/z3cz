import type { JWTTokenPayload } from "@dafthunk/types";

import type { TranslateFn } from "@/i18n";
import { AuthError } from "@/services/auth-service";

export function isPlatformAdmin(user: JWTTokenPayload): boolean {
  return user.role === "admin";
}

export function getDashboardPath(user: JWTTokenPayload): string | null {
  if (isPlatformAdmin(user)) {
    return "/admin";
  }

  const organizationId = user.organization?.id;
  if (!organizationId) {
    return null;
  }

  return `/org/${organizationId}/dashboard`;
}

export function mapAuthErrorMessage(
  error: unknown,
  t: TranslateFn
): string {
  if (error instanceof AuthError && error.code === "EMAIL_NOT_FOUND") {
    return t("auth.errors.emailNotFound");
  }

  if (!(error instanceof Error)) {
    return t("auth.errors.generic");
  }

  switch (error.message) {
    case "Invalid email or password":
      return t("auth.errors.invalidCredentials");
    case "Email already registered":
      return t("auth.errors.emailAlreadyRegistered");
    case "Registration failed":
      return t("auth.errors.registrationFailed");
    case "Login failed":
      return t("auth.errors.loginFailed");
    case "Authentication service misconfigured":
      return t("auth.errors.authMisconfigured");
    case "API unavailable":
      return t("auth.errors.apiUnavailable");
    default:
      return error.message;
  }
}
