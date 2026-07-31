import { JWTTokenPayload } from "@dafthunk/types";

import { buildApiUrl } from "@/config/api";

import { handleSessionExpired } from "./session-expired";
import {
  isCloudStorageApiErrorCode,
  reportCloudStorageError,
} from "./cloud-storage-error-reporter";

export interface RefreshAccessTokenResult {
  readonly status: "success" | "unauthorized" | "error";
  readonly user?: JWTTokenPayload;
  readonly error?: Error;
}

let refreshPromise: Promise<RefreshAccessTokenResult> | null = null;

/**
 * Refresh the access token using the refresh token
 * This is a shared function that updates both cookies and SWR cache
 */
export const refreshAccessToken =
  async (): Promise<RefreshAccessTokenResult> => {
    if (refreshPromise) {
      // All callers in this tab share one refresh request.
      return refreshPromise;
    }

    refreshPromise = (async () => {
      try {
        const response = await makeRequest<{
          success: boolean;
          user?: JWTTokenPayload;
        }>(
          "/auth/refresh",
          {
            method: "POST",
          },
          true
        );

        if (!response.success || !response.user?.sub || !response.user.name) {
          return { status: "unauthorized" };
        }

        const { mutate } = await import("swr");
        const { AUTH_USER_KEY } = await import("@/components/auth-context");
        mutate(AUTH_USER_KEY, response.user, { revalidate: false });

        return { status: "success", user: response.user };
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 401) {
          return { status: "unauthorized" };
        }

        const refreshError =
          error instanceof Error ? error : new Error(String(error));
        console.error("Token refresh failed:", refreshError);
        return { status: "error", error: refreshError };
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  };

interface ApiErrorBody {
  error?: string;
  message?: string;
  code?: string;
  jobId?: string;
  reason?: string;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly jobId?: string
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

const throwApiRequestError = (
  status: number,
  errorData: ApiErrorBody | null
): never => {
  const message =
    errorData?.message ||
    errorData?.error ||
    `Request failed with status: ${status}`;

  if (isCloudStorageApiErrorCode(errorData?.code)) {
    reportCloudStorageError(
      errorData?.reason === "cors_not_configured" ? "cors_upload" : "api"
    );
  }

  throw new ApiRequestError(
    message,
    status,
    errorData?.code,
    errorData?.jobId
  );
};

/**
 * Make a generic request to the API
 */
export const makeRequest = async <T>(
  endpoint: string,
  options: RequestInit = {},
  skipRefresh = false
): Promise<T> => {
  const fullUrl = buildApiUrl(endpoint);

  const defaultHeaders: HeadersInit = {
    "Content-Type": "application/json",
  };

  // If body is FormData, remove Content-Type to let the browser set it with boundary
  if (options.body instanceof FormData) {
    delete defaultHeaders["Content-Type"];
  }

  const requestOptions: RequestInit = {
    ...options, // Spread incoming options first
    headers: {
      ...defaultHeaders,
      ...options.headers, // Then spread specific headers from options, allowing override
    },
    credentials: options.credentials || "include",
  };

  const response = await fetch(fullUrl, requestOptions);

  // Check if token refresh is needed (only for successful requests)
  if (
    !skipRefresh &&
    response.ok &&
    response.headers.get("X-Token-Refresh-Needed") === "true"
  ) {
    void refreshAccessToken();
  }

  if (!response.ok) {
    if (response.status === 401 && !skipRefresh) {
      const refreshResult = await refreshAccessToken();
      if (refreshResult.status === "success") {
        const retryResponse = await fetch(fullUrl, requestOptions);
        if (retryResponse.ok) {
          if (retryResponse.status === 204) {
            return undefined as T;
          }
          const contentType = retryResponse.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            return undefined as T;
          }
          return retryResponse.json();
        }

        let retryErrorData: ApiErrorBody | null = null;
        try {
          retryErrorData = (await retryResponse.json()) as ApiErrorBody;
        } catch {
          retryErrorData = null;
        }
        throwApiRequestError(retryResponse.status, retryErrorData);
      } else if (refreshResult.status === "unauthorized") {
        await handleSessionExpired();
        throw new ApiRequestError("Session expired", 401, "UNAUTHORIZED");
      } else {
        throw refreshResult.error ?? new Error("Token refresh failed");
      }
    }

    let errorData: ApiErrorBody | null = null;
    try {
      errorData = (await response.json()) as ApiErrorBody;
    } catch {
      errorData = null;
    }
    throwApiRequestError(response.status, errorData);
  }

  // Handle responses that are OK but might not have a JSON body
  if (response.status === 204) {
    return undefined as T; // Or handle as appropriate for your expected T types
  }

  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    // If content type is not JSON, or not present, and status is not 204 (handled above)
    // consider what to return. For now, assuming it might be an issue or should be specifically handled by callers.
    // If T can be string for text responses, this needs more sophisticated handling.
    // For now, if it's not JSON and not 204, we'll assume it's an unexpected success scenario or should be handled by `response.text()` if needed.
    // To keep it simple and address the core issue of .json() failing:
    return undefined as T; // Or throw an error if non-JSON successful responses are unexpected
  }

  return response.json();
};

/**
 * Make a request to the API with organization context
 */
export const makeOrgRequest = async <T>(
  orgId: string,
  resourcePath: string,
  endpoint: string = "",
  options: RequestInit = {}
): Promise<T> => {
  const fullEndpoint = `/${orgId}${resourcePath}${endpoint}`;
  return makeRequest<T>(fullEndpoint, options);
};
