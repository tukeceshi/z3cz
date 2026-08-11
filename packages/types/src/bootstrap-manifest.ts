export interface BootstrapManifestFile {
  readonly path: string;
  readonly size: number;
}

export interface BootstrapManifest {
  readonly version: 1;
  readonly entry: string;
  readonly css: readonly string[];
  readonly files: readonly BootstrapManifestFile[];
  readonly preloadFiles?: readonly BootstrapManifestFile[];
  readonly manifestVersion: string;
}

export interface BootstrapConfigResponse {
  readonly enabled: boolean;
  readonly entry: string;
  readonly css: readonly string[];
  readonly files: readonly BootstrapManifestFile[];
  readonly preloadFiles: readonly BootstrapManifestFile[];
  readonly manifestVersion: string;
}
