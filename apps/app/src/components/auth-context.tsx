import {
  type AuthProvider,
  JWTTokenPayload,
  OrganizationInfo,
} from "@dafthunk/types";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import useSWR from "swr";

import { AuthError, authService } from "@/services/auth-service";

export const AUTH_USER_KEY = "/auth/user";

type AuthContextType = {
  readonly user: JWTTokenPayload | null;
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly loginError: Error | null;
  readonly organization: OrganizationInfo | null;
  login: (provider: AuthProvider, returnTo?: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAllSessions: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshToken: () => Promise<{
    success: boolean;
    user?: JWTTokenPayload;
    error?: string;
  }>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    data: user,
    error: swrError,
    isLoading: isUserLoading,
    mutate: mutateUser,
  } = useSWR<JWTTokenPayload | null>(
    AUTH_USER_KEY,
    authService.getCurrentUser,
    {
      dedupingInterval: 2000,
      shouldRetryOnError: (error) => !(error instanceof AuthError),
      refreshInterval: 5 * 60 * 1000,
      refreshWhenHidden: false,
      onSuccess: (data) => {
        if (data && (!data.sub || !data.name)) {
          console.error("Invalid user data structure received");
          mutateUser(null, { revalidate: false });
        }
      },
      onError: (error) => {
        if (error instanceof AuthError) {
          mutateUser(null, { revalidate: false });
        }
      },
    }
  );

  const [loginError, setLoginError] = useState<Error | null>(null);

  // A transient request/refresh failure is not proof that the session ended.
  // Keep route guards pending while SWR retries instead of showing /login.
  const isLoading =
    isUserLoading ||
    (!user && !!swrError && !(swrError instanceof AuthError));
  const isAuthenticated = !!user?.sub && !(swrError instanceof AuthError);

  const organization = useMemo<OrganizationInfo | null>(() => {
    if (!user?.organization?.id) {
      return null;
    }
    return user.organization;
  }, [user?.organization]);

  const clearError = useCallback(() => {
    setLoginError(null);
  }, []);

  const refreshUserContext = useCallback(async (): Promise<void> => {
    try {
      await mutateUser();
    } catch (error) {
      console.error("Failed to refresh user context:", error);
      throw error;
    }
  }, [mutateUser]);

  const login = useCallback(
    async (provider: AuthProvider, returnTo?: string): Promise<void> => {
      setLoginError(null);
      try {
        await authService.loginWithProvider(provider, returnTo);
      } catch (err) {
        console.error("Login process error:", err);
        const error = err instanceof Error ? err : new Error(String(err));
        setLoginError(error);
        throw error;
      }
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authService.logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  }, []);

  const logoutAllSessions = useCallback(async (): Promise<void> => {
    try {
      await authService.logoutAllSessions();
    } catch (error) {
      console.error("Logout all sessions error:", error);
    }
  }, []);

  const refreshToken = useCallback(async (): Promise<{
    success: boolean;
    user?: JWTTokenPayload;
    error?: string;
  }> => {
    try {
      const result = await authService.refreshToken();

      if (result.success && result.user) {
        mutateUser(result.user, { revalidate: false });
      } else if (!result.success) {
        console.warn("Token refresh failed, clearing user data");
        mutateUser(null, { revalidate: false });
      }

      return result;
    } catch (error) {
      console.error("Token refresh error:", error);
      mutateUser(null, { revalidate: false });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }, [mutateUser]);

  const processedError =
    swrError instanceof AuthError
      ? new Error("Authentication failed. Please log in again.")
      : swrError;

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isAuthenticated,
        isLoading,
        error: processedError,
        loginError,
        organization,
        login,
        logout,
        logoutAllSessions,
        refreshUser: refreshUserContext,
        refreshToken,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
