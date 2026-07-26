export interface EmailAuthConfig {
  requireVerificationOnRegister: boolean;
  smtpHost: string;
  smtpPort: number | null;
  smtpUser: string;
  smtpPassword: string;
  fromAddress: string;
}

export interface OAuthProviderAuthConfig {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
}

export interface AuthConfig {
  email: EmailAuthConfig;
  github: OAuthProviderAuthConfig;
  google: OAuthProviderAuthConfig;
}

export interface AdminEmailAuthConfig extends EmailAuthConfig {
  smtpPasswordConfigured: boolean;
}

export interface AdminOAuthProviderAuthConfig extends OAuthProviderAuthConfig {
  clientSecretConfigured: boolean;
}

export interface AdminAuthConfig {
  email: AdminEmailAuthConfig;
  github: AdminOAuthProviderAuthConfig;
  google: AdminOAuthProviderAuthConfig;
  updatedAt: string;
  updatedBy: string | null;
}

export interface PublicAuthConfig {
  email: {
    requireVerificationOnRegister: boolean;
  };
  github: {
    enabled: boolean;
    clientId: string | null;
  };
  google: {
    enabled: boolean;
    clientId: string | null;
  };
}

export interface UpdateAuthConfigRequest {
  email?: Partial<EmailAuthConfig> & {
    smtpPassword?: string;
  };
  github?: Partial<OAuthProviderAuthConfig> & {
    clientSecret?: string;
  };
  google?: Partial<OAuthProviderAuthConfig> & {
    clientSecret?: string;
  };
}

export interface SendRegistrationCodeRequest {
  email: string;
}

export interface SendRegistrationCodeResponse {
  success: boolean;
}

export interface PasswordRegisterRequestWithCode {
  email: string;
  password: string;
  verificationCode?: string;
}

export const DEFAULT_AUTH_CONFIG: AuthConfig = {
  email: {
    requireVerificationOnRegister: false,
    smtpHost: "",
    smtpPort: null,
    smtpUser: "",
    smtpPassword: "",
    fromAddress: "",
  },
  github: {
    enabled: false,
    clientId: "",
    clientSecret: "",
  },
  google: {
    enabled: false,
    clientId: "",
    clientSecret: "",
  },
};

export const AUTH_CONFIG_SECRET_MASK = "••••••••";

export function isSmtpConfigured(email: EmailAuthConfig): boolean {
  return (
    email.smtpHost.trim().length > 0 &&
    email.smtpPort !== null &&
    email.smtpPort > 0 &&
    email.smtpUser.trim().length > 0 &&
    email.smtpPassword.trim().length > 0 &&
    email.fromAddress.trim().length > 0
  );
}

export function mergeAuthConfig(partial: Partial<AuthConfig> | null | undefined): AuthConfig {
  if (!partial) {
    return { ...DEFAULT_AUTH_CONFIG };
  }

  return {
    email: {
      ...DEFAULT_AUTH_CONFIG.email,
      ...partial.email,
      smtpPort:
        partial.email?.smtpPort === undefined
          ? DEFAULT_AUTH_CONFIG.email.smtpPort
          : partial.email.smtpPort,
    },
    github: {
      ...DEFAULT_AUTH_CONFIG.github,
      ...partial.github,
    },
    google: {
      ...DEFAULT_AUTH_CONFIG.google,
      ...partial.google,
    },
  };
}
