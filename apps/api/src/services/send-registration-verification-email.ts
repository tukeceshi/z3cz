import type { Bindings } from "../context";
import type { AuthConfig } from "@dafthunk/types";
import { isSmtpConfigured } from "@dafthunk/types";

import { createEmailService } from "./email-service";

interface VerificationEmailInput {
  to: string;
  code: string;
  siteName: string;
}

export async function sendRegistrationVerificationEmail(
  env: Bindings,
  authConfig: AuthConfig,
  input: VerificationEmailInput
): Promise<{ ok: boolean; error?: string }> {
  const fromAddress =
    authConfig.email.fromAddress.trim() || env.SEND_EMAIL_FROM?.trim() || "";

  if (!fromAddress) {
    return { ok: false, error: "From address is not configured" };
  }

  const subject = `${input.siteName} registration code`;
  const text = `Your verification code is ${input.code}. It expires in 10 minutes.`;

  if (isSmtpConfigured(authConfig.email)) {
    if (env.RUNTIME === "node") {
      return sendViaSmtp(authConfig, {
        from: fromAddress,
        to: input.to,
        subject,
        text,
      });
    }
    return {
      ok: false,
      error: "Custom SMTP is only supported on the Node runtime",
    };
  }

  const emailService = createEmailService(env);
  if (!emailService) {
    return { ok: false, error: "Email service is not configured" };
  }

  const result = await emailService.send({
    from: fromAddress,
    to: input.to,
    subject,
    text,
  });

  if (!result.success) {
    return { ok: false, error: result.error ?? "Failed to send email" };
  }

  return { ok: true };
}

async function sendViaSmtp(
  authConfig: AuthConfig,
  input: { from: string; to: string; subject: string; text: string }
): Promise<{ ok: boolean; error?: string }> {
  const email = authConfig.email;

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: email.smtpHost.trim(),
      port: email.smtpPort ?? 587,
      secure: email.smtpPort === 465,
      auth: {
        user: email.smtpUser.trim(),
        pass: email.smtpPassword,
      },
    });

    await transporter.sendMail({
      from: input.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
    });

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "SMTP send failed",
    };
  }
}
