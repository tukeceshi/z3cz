import { SMTPServer } from "smtp-server";

interface GatewayConfig {
  readonly apiUrl: string;
  readonly inboundSecret: string;
  readonly smtpPort: number;
  readonly smtpHost: string;
}

function loadConfig(): GatewayConfig {
  const apiUrl = (process.env.API_URL ?? "http://localhost:3102").replace(/\/$/, "");
  const inboundSecret = process.env.INBOUND_EMAIL_SECRET?.trim() ?? "";
  const smtpPort = Number(process.env.SMTP_PORT ?? 2525);
  const smtpHost = process.env.SMTP_HOST ?? "0.0.0.0";

  if (!inboundSecret) {
    throw new Error("INBOUND_EMAIL_SECRET is required for smtp-gateway");
  }

  return { apiUrl, inboundSecret, smtpPort, smtpHost };
}

async function forwardToApi(
  config: GatewayConfig,
  envelope: { from: string; to: string[] },
  rawMime: Buffer
): Promise<void> {
  const toAddress = envelope.to[0];
  if (!toAddress) {
    throw new Error("Missing envelope recipient");
  }

  const response = await fetch(`${config.apiUrl}/inbound-email/raw`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.inboundSecret}`,
      "Content-Type": "message/rfc822",
      "X-Envelope-From": envelope.from,
      "X-Envelope-To": toAddress,
    },
    body: rawMime,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API rejected inbound email (${response.status}): ${body}`);
  }
}

function startGateway(config: GatewayConfig): SMTPServer {
  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ["AUTH"],
    onData(stream, session, callback) {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });
      stream.on("end", () => {
        void (async () => {
          try {
            const rawMime = Buffer.concat(chunks);
            await forwardToApi(
              config,
              {
                from: session.envelope.mailFrom ?? "",
                to: session.envelope.rcptTo.map((rcpt) => rcpt.address),
              },
              rawMime
            );
            callback();
          } catch (error) {
            callback(error instanceof Error ? error : new Error(String(error)));
          }
        })();
      });
    },
  });

  server.listen(config.smtpPort, config.smtpHost, () => {
    console.log(
      `[smtp-gateway] Listening on ${config.smtpHost}:${config.smtpPort} → ${config.apiUrl}/inbound-email/raw`
    );
  });

  return server;
}

startGateway(loadConfig());
