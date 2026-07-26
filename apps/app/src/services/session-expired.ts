import { mutate } from "swr";

import { AUTH_USER_KEY } from "@/components/auth-context";
import { buildApiUrl } from "@/config/api";

let isHandlingSessionExpired = false;

export async function handleSessionExpired(): Promise<void> {
  if (isHandlingSessionExpired || typeof window === "undefined") {
    return;
  }

  if (window.location.pathname.startsWith("/login")) {
    mutate(AUTH_USER_KEY, null, { revalidate: false });
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
    // Best-effort cookie cleanup before redirect.
  }

  const returnTo = encodeURIComponent(
    `${window.location.pathname}${window.location.search}`
  );
  window.location.assign(`/login?returnTo=${returnTo}`);
}
