/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_HOST?: string;
  readonly VITE_WS_HOST?: string;
  /** When "1"/"true", WebSocket uses same-origin API base (Caddy gateway / host). */
  readonly VITE_WS_VIA_PROXY?: string;
  readonly VITE_WEBSITE_URL?: string;
  readonly VITE_APP_URL?: string;
  readonly VITE_CONTACT_EMAIL?: string;
  readonly VITE_GA_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
