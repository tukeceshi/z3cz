import type { BootstrapShellSource } from "./bootstrap-settings";

export interface BootstrapPrefetchPack {
  readonly id: string;
  readonly path: string;
  readonly hash: string;
  readonly assets: readonly string[];
}

export interface BootstrapManifest {
  readonly version: 1;
  readonly entry: string;
  readonly css: readonly string[];
  readonly shell: string;
  readonly shellHash: string;
  readonly manifestVersion: string;
  readonly prefetchPacks: readonly BootstrapPrefetchPack[];
  readonly routeToPacks: Readonly<Record<string, readonly string[]>>;
}

export interface BootstrapPrefetchPackConfig extends BootstrapPrefetchPack {
  readonly sources: readonly BootstrapShellSource[];
}

export interface BootstrapConfigResponse {
  readonly shell: string;
  readonly shellHash: string;
  readonly entry: string;
  readonly css: readonly string[];
  readonly manifestVersion: string;
  readonly shellSources: readonly BootstrapShellSource[];
  readonly prefetchPacks: readonly BootstrapPrefetchPackConfig[];
  readonly routeToPacks: Readonly<Record<string, readonly string[]>>;
}
