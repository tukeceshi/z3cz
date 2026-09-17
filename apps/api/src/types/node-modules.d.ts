declare module "ssh2" {
  interface ExecStream extends NodeJS.ReadableStream {
    stderr: NodeJS.ReadableStream;
    end(data: string): void;
  }

  export class Client {
    on(event: string, listener: (...args: unknown[]) => void): this;
    connect(config: Record<string, unknown>): void;
    end(): void;
    exec(
      command: string,
      callback: (error: Error | undefined, stream: ExecStream) => void
    ): void;
  }
}

declare module "nodemailer" {
  export interface Transporter {
    sendMail(mail: unknown): Promise<unknown>;
  }

  export function createTransport(options: unknown): Transporter;
}
