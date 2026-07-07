declare module "cloudflare:test" {
  // Controls the type of `import("cloudflare:test").env`
  interface ProvidedEnv extends Env {
    AI: Ai;
    DATABASE_URL?: string;
    HYPERDRIVE?: Hyperdrive;
    DATASETS_AUTORAG: string;
    CLOUDFLARE_ACCOUNT_ID: string;
    CLOUDFLARE_API_TOKEN: string;
  }
}
