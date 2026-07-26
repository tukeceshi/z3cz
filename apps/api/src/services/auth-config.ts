import type {
  AdminAuthConfig,
  AuthConfig,
  PublicAuthConfig,
  UpdateAuthConfigRequest,
} from "@dafthunk/types";
import {
  AUTH_CONFIG_SECRET_MASK,
  DEFAULT_AUTH_CONFIG,
  isSmtpConfigured,
  mergeAuthConfig,
} from "@dafthunk/types";

import type { Bindings } from "../context";
import { createEmailService } from "./email-service";

export function parseAuthConfig(value: string | null): AuthConfig {
  if (!value) {
    return mergeAuthConfig(null);
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") {
      return mergeAuthConfig(null);
    }
    return mergeAuthConfig(parsed as Partial<AuthConfig>);
  } catch {
    return mergeAuthConfig(null);
  }
}

export function serializeAuthConfig(config: AuthConfig): string {
  return JSON.stringify(mergeAuthConfig(config));
}

function maskSecret(secret: string): string {
  return secret.trim().length > 0 ? AUTH_CONFIG_SECRET_MASK : "";
}

export function toAdminAuthConfig(
  config: AuthConfig,
  updatedAt: string,
  updatedBy: string | null
): AdminAuthConfig {
  return {
    email: {
      ...config.email,
      smtpPassword: maskSecret(config.email.smtpPassword),
      smtpPasswordConfigured: config.email.smtpPassword.trim().length > 0,
    },
    github: {
      ...config.github,
      clientSecret: maskSecret(config.github.clientSecret),
      clientSecretConfigured: config.github.clientSecret.trim().length > 0,
    },
    google: {
      ...config.google,
      clientSecret: maskSecret(config.google.clientSecret),
      clientSecretConfigured: config.google.clientSecret.trim().length > 0,
    },
    updatedAt,
    updatedBy,
  };
}

export function toPublicAuthConfig(config: AuthConfig): PublicAuthConfig {
  return {
    email: {
      requireVerificationOnRegister: config.email.requireVerificationOnRegister,
    },
    github: {
      enabled: config.github.enabled,
      clientId: config.github.enabled ? config.github.clientId.trim() || null : null,
    },
    google: {
      enabled: config.google.enabled,
      clientId: config.google.enabled ? config.google.clientId.trim() || null : null,
    },
  };
}

export function isOAuthProviderConfigured(
  provider: OAuthProviderAuthConfigShape
): boolean {
  return (
    provider.clientId.trim().length > 0 && provider.clientSecret.trim().length > 0
  );
}

interface OAuthProviderAuthConfigShape {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
}

export function canEnableEmailVerification(
  config: AuthConfig,
  env: Bindings
): boolean {
  if (!config.email.fromAddress.trim()) {
    return false;
  }

  if (isSmtpConfigured(config.email)) {
    return true;
  }

  return createEmailService(env) !== null;
}

export function canEnableOAuthProvider(
  provider: OAuthProviderAuthConfigShape,
  env?: Bindings,
  providerName?: "github" | "google"
): boolean {
  if (isOAuthProviderConfigured(provider)) {
    return true;
  }

  if (!env || !providerName) {
    return false;
  }

  const envClientId =
    providerName === "github" ? env.GITHUB_CLIENT_ID : env.GOOGLE_CLIENT_ID;
  const envClientSecret =
    providerName === "github"
      ? env.GITHUB_CLIENT_SECRET
      : env.GOOGLE_CLIENT_SECRET;

  return Boolean(envClientId?.trim() && envClientSecret?.trim());
}

export function resolveOAuthCredentials(
  provider: "github" | "google",
  config: AuthConfig,
  env: Bindings
): { enabled: boolean; clientId: string; clientSecret: string } | null {
  const providerConfig = provider === "github" ? config.github : config.google;
  const envClientId =
    provider === "github" ? env.GITHUB_CLIENT_ID : env.GOOGLE_CLIENT_ID;
  const envClientSecret =
    provider === "github" ? env.GITHUB_CLIENT_SECRET : env.GOOGLE_CLIENT_SECRET;

  const clientId = providerConfig.clientId.trim() || envClientId?.trim() || "";
  const clientSecret =
    providerConfig.clientSecret.trim() || envClientSecret?.trim() || "";

  if (!providerConfig.enabled) {
    return null;
  }

  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    enabled: true,
    clientId,
    clientSecret,
  };
}

export function isOAuthLoginEnabled(
  provider: "github" | "google",
  config: AuthConfig,
  env: Bindings
): boolean {
  return resolveOAuthCredentials(provider, config, env) !== null;
}

export function mergeAuthConfigUpdate(
  existing: AuthConfig,
  input: UpdateAuthConfigRequest
): AuthConfig {
  const next = mergeAuthConfig(existing);

  if (input.email) {
    if (input.email.requireVerificationOnRegister !== undefined) {
      next.email.requireVerificationOnRegister =
        input.email.requireVerificationOnRegister;
    }
    if (input.email.smtpHost !== undefined) {
      next.email.smtpHost = input.email.smtpHost;
    }
    if (input.email.smtpPort !== undefined) {
      next.email.smtpPort = input.email.smtpPort;
    }
    if (input.email.smtpUser !== undefined) {
      next.email.smtpUser = input.email.smtpUser;
    }
    if (input.email.fromAddress !== undefined) {
      next.email.fromAddress = input.email.fromAddress;
    }
    if (
      input.email.smtpPassword !== undefined &&
      input.email.smtpPassword !== AUTH_CONFIG_SECRET_MASK &&
      input.email.smtpPassword.trim().length > 0
    ) {
      next.email.smtpPassword = input.email.smtpPassword;
    }
  }

  if (input.github) {
    if (input.github.enabled !== undefined) {
      next.github.enabled = input.github.enabled;
    }
    if (input.github.clientId !== undefined) {
      next.github.clientId = input.github.clientId;
    }
    if (
      input.github.clientSecret !== undefined &&
      input.github.clientSecret !== AUTH_CONFIG_SECRET_MASK &&
      input.github.clientSecret.trim().length > 0
    ) {
      next.github.clientSecret = input.github.clientSecret;
    }
  }

  if (input.google) {
    if (input.google.enabled !== undefined) {
      next.google.enabled = input.google.enabled;
    }
    if (input.google.clientId !== undefined) {
      next.google.clientId = input.google.clientId;
    }
    if (
      input.google.clientSecret !== undefined &&
      input.google.clientSecret !== AUTH_CONFIG_SECRET_MASK &&
      input.google.clientSecret.trim().length > 0
    ) {
      next.google.clientSecret = input.google.clientSecret;
    }
  }

  return mergeAuthConfig(next);
}

export function validateAuthConfigUpdate(
  config: AuthConfig,
  env: Bindings
): string | null {
  if (
    config.email.requireVerificationOnRegister &&
    !canEnableEmailVerification(config, env)
  ) {
    return "Email verification requires a from address and working email delivery";
  }

  if (config.github.enabled && !canEnableOAuthProvider(config.github, env, "github")) {
    return "GitHub login requires Client ID and Client Secret";
  }

  if (config.google.enabled && !canEnableOAuthProvider(config.google, env, "google")) {
    return "Google login requires Client ID and Client Secret";
  }

  return null;
}

export { DEFAULT_AUTH_CONFIG };
