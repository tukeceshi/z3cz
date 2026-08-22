import type { IncomingMessage, ServerResponse } from "node:http";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const REFRESH_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>`;

export interface MaintenancePageOptions {
  readonly message?: string | null;
  readonly defaultMessage?: string;
  readonly refreshAriaLabel?: string;
}

export function renderMaintenancePageHtml(
  options: MaintenancePageOptions = {}
): string {
  const defaultMessage =
    options.defaultMessage ??
    "The system is under maintenance. Please try again later.";
  const bodyMessage = escapeHtml(
    options.message?.trim() ? options.message.trim() : defaultMessage
  );
  const refreshAriaLabel = escapeHtml(options.refreshAriaLabel ?? "Refresh");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Maintenance</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    background: transparent;
    color: CanvasText;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .panel {
    max-width: 420px;
    width: 100%;
    text-align: center;
  }
  p {
    line-height: 1.6;
    margin-bottom: 16px;
    white-space: pre-wrap;
  }
  button {
    appearance: none;
    border: none;
    background: transparent;
    color: inherit;
    border-radius: 9999px;
    padding: 8px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    opacity: 0.72;
  }
  button:hover { opacity: 1; }
  button:active { opacity: 0.56; }
</style>
</head>
<body>
  <div class="panel">
    <p>${bodyMessage}</p>
    <button type="button" onclick="location.reload()" aria-label="${refreshAriaLabel}">${REFRESH_ICON_SVG}</button>
  </div>
</body>
</html>`;
}

export interface MaintenanceStatusResult {
  readonly active: boolean;
  readonly message: string | null;
}

export async function fetchMaintenanceStatus(
  siteSettingsUrl: string,
  timeoutMs = 3_000
): Promise<MaintenanceStatusResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(siteSettingsUrl, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      return { active: true, message: null };
    }
    const data = (await response.json()) as {
      maintenanceEnabled?: boolean;
      maintenanceMessage?: string | null;
    };
    return {
      active: data.maintenanceEnabled === true,
      message:
        typeof data.maintenanceMessage === "string"
          ? data.maintenanceMessage
          : null,
    };
  } catch {
    return { active: true, message: null };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function handleMaintenanceHomepageRequest(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
  apiTarget: string
): Promise<void> {
  const urlPath = req.url?.split("?")[0] ?? "";
  if (req.method !== "GET" || urlPath !== "/") {
    next();
    return;
  }

  const accept = req.headers.accept ?? "";
  if (
    accept.length > 0 &&
    !accept.includes("text/html") &&
    accept !== "*/*"
  ) {
    next();
    return;
  }

  const status = await fetchMaintenanceStatus(`${apiTarget}/site-settings`);
  if (!status.active) {
    next();
    return;
  }

  res.statusCode = 503;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(
    renderMaintenancePageHtml({
      message: status.message,
      defaultMessage:
        "The system is under maintenance. Please try again later.",
      refreshAriaLabel: "Refresh",
    })
  );
}
