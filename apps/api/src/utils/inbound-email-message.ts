interface CreateForwardableEmailMessageArgs {
  readonly from: string;
  readonly to: string;
  readonly rawBytes: Uint8Array;
  readonly authenticationResults?: string;
}

/** Build a {@link ForwardableEmailMessage} for HTTP/webhook inbound delivery on Node. */
export function createForwardableEmailMessage(
  args: CreateForwardableEmailMessageArgs
): ForwardableEmailMessage {
  const headers = new Headers();
  if (args.authenticationResults) {
    headers.set("Authentication-Results", args.authenticationResults);
  }

  const rawBytes = args.rawBytes;
  return {
    from: args.from,
    to: args.to,
    headers,
    raw: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(rawBytes);
        controller.close();
      },
    }),
  };
}
