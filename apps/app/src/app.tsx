import {
  isRouteErrorResponse,
  Outlet,
  ScrollRestoration,
  useLocation,
  useMatches,
  useRouteError,
} from "react-router";

import { HeadSeo } from "@/components/head-seo";
import { LocaleProvider, useTranslation } from "@/components/locale-provider";
import { ThemeProvider } from "@/components/theme-provider";

import { AuthProvider } from "./components/auth-context";
import { Button } from "./components/ui/button";
import { RouteHandle } from "./routes";

const FALLBACK_ERROR_COPY = {
  title: "Unexpected Error",
  description: "Something went wrong. Please try refreshing the page.",
  refresh: "Refresh",
} as const;

function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (isRouteErrorResponse(error)) {
    return error.statusText || String(error.status);
  }
  return String(error);
}

export function FallbackErrorUI() {
  const { t } = useTranslation();
  const error = useRouteError();
  const errorMessage = resolveErrorMessage(error);
  const title = t("error.unexpectedTitle");
  const description = t("error.unexpectedDescription");
  const refreshLabel = t("error.refresh");

  return (
    <main className="h-screen w-screen flex items-center justify-center">
      <div className="relative h-full p-6 overflow-auto">
        <div className="flex flex-col items-center justify-center h-full max-w-2xl">
          <h1 className="text-2xl font-bold">
            {title === "error.unexpectedTitle"
              ? FALLBACK_ERROR_COPY.title
              : title}
          </h1>
          <p className="text-neutral-500 text-lg mt-2 mb-6">
            {description === "error.unexpectedDescription"
              ? FALLBACK_ERROR_COPY.description
              : description}
          </p>
          {errorMessage && errorMessage !== "[object Object]" ? (
            <pre className="mb-6 w-full overflow-auto rounded-md bg-neutral-900 p-4 text-left text-sm text-red-300">
              {errorMessage}
            </pre>
          ) : null}
          <Button onClick={() => window.location.reload()}>
            {refreshLabel === "error.refresh"
              ? FALLBACK_ERROR_COPY.refresh
              : refreshLabel}
          </Button>
        </div>
      </div>
    </main>
  );
}

function CurrentRouteHead() {
  const matches = useMatches();
  const location = useLocation();
  const { siteSettings } = useTranslation();
  const lastMatch = matches[matches.length - 1];
  const handle = lastMatch?.handle as RouteHandle | undefined;

  if (handle?.head) {
    if (typeof handle.head === "function") {
      return handle.head(lastMatch.params, {
        url: new URL(location.pathname, window.location.origin),
        location,
      });
    }
    return handle.head as React.ReactElement;
  }
  return <HeadSeo title={siteSettings.siteName} />;
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <LocaleProvider>
        <AuthProvider>
          <CurrentRouteHead />
          <Outlet />
          <ScrollRestoration />
        </AuthProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}

export default App;
