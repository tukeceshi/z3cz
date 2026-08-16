import { mutate } from "swr";

import { AUTH_USER_KEY } from "@/components/auth-context";
import { requestLoginDialog } from "@/components/login-dialog-bridge";
import { buildApiUrl } from "@/config/api";

let isHandlingSessionExpired = false;

export async function handleSessionExpired(): Promise<void> {
  if (isHandlingSessionExpired || typeof window === "undefined") {
    return;
  }

  isHandlingSessionExpired = true;

  mutate(AUTH_USER_KEY, null, { revalidate: false });

  try {
    await fetch(buildApiUrl("/auth/clear-session"), {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Best-effort cookie cleanup before showing login.
  }

  requestLoginDialog({ dismissible: false, goToConsole: false });
  isHandlingSessionExpired = false;
}
