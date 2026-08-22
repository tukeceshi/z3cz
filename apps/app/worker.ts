import {
  fetchMaintenanceStatus,
  renderMaintenancePageHtml,
} from "./maintenance-page";

interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      const accept = request.headers.get("accept") ?? "";
      if (
        accept.includes("text/html") ||
        accept === "*/*" ||
        accept.length === 0
      ) {
        const status = await fetchMaintenanceStatus(
          new URL("/api/site-settings", url.origin).href
        );
        if (status.active) {
          return new Response(
            renderMaintenancePageHtml({
              message: status.message,
              defaultMessage:
                "The system is under maintenance. Please try again later.",
              refreshAriaLabel: "Refresh",
            }),
            {
              status: 503,
              headers: {
                "Content-Type": "text/html; charset=utf-8",
              },
            }
          );
        }
      }
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
