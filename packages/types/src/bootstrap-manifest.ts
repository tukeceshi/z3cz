export interface BootstrapManifest {
  readonly version: 1;
  readonly entry: string;
  readonly css: readonly string[];
  readonly shell: string;
  readonly shellHash: string;
  readonly manifestVersion: string;
}

export interface BootstrapConfigResponse {
  readonly shell: string;
  readonly shellHash: string;
  readonly entry: string;
  readonly css: readonly string[];
  readonly manifestVersion: string;
}
