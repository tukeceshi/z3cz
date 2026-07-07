/** Node.js shim for `cloudflare:workers` — satisfies imports during Node dev. */
export class DurableObject {
  constructor(_state: DurableObjectState, _env: unknown) {}
}

export class RpcTarget {}

export class WorkerEntrypoint {}
