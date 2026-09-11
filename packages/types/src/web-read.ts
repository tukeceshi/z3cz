export interface WebReadRequest {
  readonly url: string;
  readonly modelCanonicalId: string;
  readonly aiInterfaceId: string;
}

export type WebReadSource = "model" | "local";

export interface WebReadResponse {
  readonly ok: true;
  readonly text: string;
  readonly source: WebReadSource;
  readonly title?: string;
  readonly url: string;
}

export interface WebReadErrorResponse {
  readonly ok: false;
  readonly error: string;
}
