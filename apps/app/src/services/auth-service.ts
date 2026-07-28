import type {
  AuthProvider,
  AuthSetupStatusResponse,
  GetSubAccountInvitationPreviewResponse,
  JWTTokenPayload,
  PasswordAuthResponse,
  RegisterSubAccountRequest,
} from "@dafthunk/types";
import { mutate } from "swr";

import { AUTH_USER_KEY } from "@/components/auth-context";
import { buildApiUrl } from "@/config/api";

import { makeRequest, ApiRequestError } from "./utils";

// Error types for better error handling
export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export const authService = {
  // Check if the user is authenticated
  async checkAuth(): Promise<boolean> {
    try {
      const response = await makeRequest<{ ok: boolean }>("/auth/protected", {
        method: "GET",
      });
      return response.ok || false;
    } catch (error) {
      console.warn("Authentication check failed:", error);
      return false;
    }
  },

  // Get the current user information
  async getCurrentUser(): Promise<JWTTokenPayload | null> {
    const fetchUser = async (): Promise<JWTTokenPayload> => {
      // skipRefresh: avoid hard session-expired redirect on public pages;
      // expired access tokens are handled below via an explicit refresh.
      const response = await makeRequest<{ user: JWTTokenPayload }>(
        "/auth/user",
        {
          method: "GET",
        },
        true
      );

      if (!response?.user) {
        throw new AuthError("Invalid user response format");
      }

      if (!response.user.sub || !response.user.name) {
        throw new AuthError("Invalid user data received");
      }

      return response.user;
    };

    try {
      return await fetchUser();
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        try {
          const refreshResponse = await makeRequest<{
            success: boolean;
            user?: JWTTokenPayload;
          }>(
            "/auth/refresh",
            {
              method: "POST",
            },
            true
          );

          if (
            refreshResponse.success &&
            refreshResponse.user?.sub &&
            refreshResponse.user.name
          ) {
            mutate(AUTH_USER_KEY, refreshResponse.user, { revalidate: false });
            return refreshResponse.user;
          }
        } catch {
          // Refresh failed — treat as logged out below.
        }

        throw new AuthError("Unauthorized", "UNAUTHORIZED");
      }

      if (error instanceof AuthError) {
        throw error;
      }

      console.error("Network error getting user info:", error);
      throw error;
    }
  },

  // Refresh the access token using the refresh token
  async refreshToken(): Promise<{
    success: boolean;
    user?: JWTTokenPayload;
    error?: string;
  }> {
    try {
      const response = await makeRequest<{
        success: boolean;
        user: JWTTokenPayload;
      }>("/auth/refresh", {
        method: "POST",
      });

      if (response.success && response.user) {
        // Validate user data before updating cache
        if (!response.user.sub || !response.user.name) {
          throw new AuthError("Invalid user data in refresh response");
        }

        // Update the SWR cache with the fresh user data
        mutate(AUTH_USER_KEY, response.user, { revalidate: false });
        return { success: true, user: response.user };
      }

      return { success: false, error: "Token refresh failed" };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Token refresh failed:", errorMessage);
      return { success: false, error: errorMessage };
    }
  },

  // Login with a provider
  async loginWithProvider(
    provider: AuthProvider,
    returnTo?: string
  ): Promise<void> {
    try {
      // Validate provider
      if (!["github", "google"].includes(provider)) {
        throw new AuthError(`Invalid auth provider: ${provider}`);
      }

      const loginUrl = new URL(buildApiUrl(`/auth/login/${provider}`));
      if (returnTo) {
        loginUrl.searchParams.set("returnTo", returnTo);
      }
      window.location.href = loginUrl.toString();
    } catch (error) {
      console.error("Login initiation failed:", error);
      throw error;
    }
  },

  async getSetupStatus(): Promise<AuthSetupStatusResponse> {
    return makeRequest<AuthSetupStatusResponse>("/auth/setup-status", {
      method: "GET",
    });
  },

  async loginWithPassword(
    email: string,
    password: string
  ): Promise<JWTTokenPayload> {
    try {
      const response = await makeRequest<PasswordAuthResponse>(
        "/auth/login/password",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        },
        true
      );

      if (!response.success || !response.user?.sub) {
        throw new AuthError("Login failed");
      }

      mutate(AUTH_USER_KEY, response.user, { revalidate: false });
      return response.user;
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "EMAIL_NOT_FOUND") {
        throw new AuthError(error.message, "EMAIL_NOT_FOUND");
      }
      if (error instanceof ApiRequestError) {
        throw new AuthError(error.message, error.code);
      }
      throw error;
    }
  },

  async registerWithPassword(
    email: string,
    password: string,
    verificationCode?: string
  ): Promise<JWTTokenPayload> {
    try {
      const response = await makeRequest<PasswordAuthResponse>(
        "/auth/register",
        {
          method: "POST",
          body: JSON.stringify({ email, password, verificationCode }),
        },
        true
      );

      if (!response.success || !response.user?.sub) {
        throw new AuthError("Registration failed");
      }

      mutate(AUTH_USER_KEY, response.user, { revalidate: false });
      mutate("/auth/setup-status");
      return response.user;
    } catch (error) {
      if (error instanceof ApiRequestError) {
        throw new AuthError(error.message, error.code);
      }
      throw error;
    }
  },

  async sendRegistrationCode(email: string): Promise<void> {
    try {
      await makeRequest<{ success: boolean }>(
        "/auth/register/send-code",
        {
          method: "POST",
          body: JSON.stringify({ email }),
        },
        true
      );
    } catch (error) {
      if (error instanceof ApiRequestError) {
        throw new AuthError(error.message, error.code);
      }
      throw error;
    }
  },

  async getSubAccountInvitationPreview(invitationId: string) {
    return makeRequest<GetSubAccountInvitationPreviewResponse>(
      `/auth/sub-account-invitations/${invitationId}`,
      { method: "GET" }
    );
  },

  async registerSubAccount(
    request: RegisterSubAccountRequest
  ): Promise<JWTTokenPayload> {
    try {
      const response = await makeRequest<PasswordAuthResponse>(
        "/auth/register/sub-account",
        {
          method: "POST",
          body: JSON.stringify(request),
        },
        true
      );

      if (!response.success || !response.user?.sub) {
        throw new AuthError("Registration failed");
      }

      mutate(AUTH_USER_KEY, response.user, { revalidate: false });
      return response.user;
    } catch (error) {
      if (error instanceof ApiRequestError) {
        throw new AuthError(error.message, error.code);
      }
      throw error;
    }
  },

  async clearSession(): Promise<void> {
    mutate(AUTH_USER_KEY, null, { revalidate: false });
    try {
      await makeRequest<{ ok: boolean }>(
        "/auth/clear-session",
        { method: "POST" },
        true
      );
    } catch (error) {
      console.warn("Failed to clear auth session cookies:", error);
    }
  },

  // Logout the user
  async logout(): Promise<void> {
    try {
      await makeRequest<void>("/auth/logout", {
        method: "POST",
      });
    } catch (error) {
      // Log but don't throw - logout should always clear local state
      console.error("Logout request failed:", error);
    } finally {
      // Always invalidate cache and redirect regardless of API call success
      try {
        mutate(AUTH_USER_KEY, null, { revalidate: false });
      } catch (mutateError) {
        console.error("Failed to clear auth cache:", mutateError);
      }
      window.location.href = "/";
    }
  },

  // Logout all sessions for the user
  async logoutAllSessions(): Promise<void> {
    try {
      await makeRequest<void>("/auth/logout-all", {
        method: "POST",
      });
    } catch (error) {
      // Log but don't throw - logout should always clear local state
      console.error("Logout all sessions failed:", error);
    } finally {
      // Always invalidate cache and redirect regardless of API call success
      try {
        mutate(AUTH_USER_KEY, null, { revalidate: false });
      } catch (mutateError) {
        console.error("Failed to clear auth cache:", mutateError);
      }
      window.location.href = "/";
    }
  },
} as const;
