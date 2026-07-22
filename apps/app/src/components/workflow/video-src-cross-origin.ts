import { getApiBaseUrl } from "@/config/api";

/** crossOrigin=anonymous is only safe for blob / same-origin API URLs (frame capture). */
export function videoSrcAllowsCrossOrigin(src: string): boolean {
  if (src.startsWith("blob:")) {
    return true;
  }

  const apiBase = getApiBaseUrl();
  if (apiBase.startsWith("http://") || apiBase.startsWith("https://")) {
    return src.startsWith(apiBase);
  }

  if (typeof window !== "undefined") {
    return src.startsWith(window.location.origin);
  }

  return false;
}
