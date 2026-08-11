export interface BootstrapManifest {
  readonly version: 1;
  readonly entry: string;
  readonly css: readonly string[];
  readonly shell: string;
  readonly shellHash: string;
  readonly manifestVersion: string;
}

import type { BootstrapShellSource } from "./bootstrap-settings";

export interface BootstrapConfigResponse {
  readonly shellEnabled: boolean;
  readonly multiSourceRaceEnabled: boolean;
  readonly shell: string;
  readonly shellHash: string;
  readonly entry: string;
  readonly css: readonly string[];
  readonly manifestVersion: string;
  readonly shellSources: readonly BootstrapShellSource[];
}
