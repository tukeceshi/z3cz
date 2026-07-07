/** Node.js shim for `cloudflare:email` — real sends require Workers SEND_EMAIL binding. */
export class EmailMessage {
  constructor(
    readonly from: string,
    readonly to: string,
    readonly raw: string
  ) {}
}
