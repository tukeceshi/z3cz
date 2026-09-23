/** Node.js shim for `cloudflare:workers` — satisfies imports during Node dev. */
export class DurableObject {
  constructor(_state: DurableObjectState, _env: unknown) {}
}

export class RpcTarget {}

export class WorkerEntrypoint {}

// Cloudflare-only globals imported by partyserver/agents. Node paths do not
// invoke them, but concrete exports keep the production bundle self-contained.
export const env: Record<string, unknown> = {};
export const exports: Record<string, unknown> = {};
