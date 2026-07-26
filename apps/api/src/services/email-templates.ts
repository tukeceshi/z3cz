/**
 * Email templates for application notifications
 */

export interface WelcomeEmailParams {
  userName: string;
  appUrl: string;
  websiteUrl: string;
  discordUrl?: string;
  githubUrl?: string;
}

/**
 * Generate welcome email content for new users
 */
export function getWelcomeEmail(params: WelcomeEmailParams): {
  subject: string;
  text: string;
  html: string;
} {
  const { userName, appUrl, websiteUrl, discordUrl, githubUrl } = params;
  const docsUrl = `${appUrl}/docs/concepts`;

  const subject = "Welcome to z3cz.com";

  const text = `Welcome${userName ? `, ${userName}` : ""}.

What would you like to automate?

Just hit reply with one thing you want to automate and I'll try to point you at a template or starting workflow. I do my best to read every message. If this landed in spam, mark it as "not spam" so my reply reaches you.

z3cz.com is a visual way to build serverless workflows on Cloudflare. Drag nodes, connect them, deploy to the edge.

Here are some quick tips:
• Start from a use case template to see how nodes wire together
• Experiment with AI nodes (Claude, GPT, Gemini, Replicate) in the playground
• Add a trigger: webhooks, requests, email, cron, queues, or bots
• Connect integrations like GitHub, Discord, Telegram or Gmail
• Browse the Nodes Reference to see all 400+ available nodes
• Bonus: it's open source (MIT). Self-host it and contribute
• Learn more: ${docsUrl}

${discordUrl ? `Prefer a quick chat? Join us on Discord: ${discordUrl}\n\n` : ""}${githubUrl ? `Want to help? Contribute on GitHub: ${githubUrl}\n\n` : ""}

Happy automating,

Bertil Chapuis

—
z3cz.com · Visual workflow automation
${websiteUrl}`;

  const html = `<p>Welcome${userName ? `, ${userName}` : ""}.</p>
<p>What would you like to automate?</p>
<p>Just hit reply with one thing you want to automate and I'll try to point you at a template or starting workflow. I do my best to read every message. If this landed in spam, mark it as "not spam" so my reply reaches you.</p>
<p>z3cz.com is a visual way to build serverless workflows on Cloudflare. Drag nodes, connect them, deploy to the edge.</p>
<p>Here are some quick tips:</p>
<ul>
<li>Start from a use case template to see how nodes wire together</li>
<li>Experiment with AI nodes (Claude, GPT, Gemini, Replicate) in the playground</li>
<li>Add a trigger: webhooks, requests, email, cron, queues, or bots</li>
<li>Connect integrations like GitHub, Discord, Telegram or Gmail</li>
<li>Browse the Nodes Reference to see all 400+ available nodes</li>
<li>Bonus: it's open source (MIT). Self-host it and contribute</li>
<li><a href="${docsUrl}">Learn more</a></li>
</ul>
${discordUrl ? `<p>Prefer a quick chat? <a href="${discordUrl}">Join us on Discord</a></p>\n` : ""}${githubUrl ? `<p>Want to help? <a href="${githubUrl}">Contribute on GitHub</a></p>\n` : ""}
<p>Happy automating</p>
<p>Bertil Chapuis</p>
<p>—<br>z3cz.com · Visual workflow automation<br><a href="${websiteUrl}">${websiteUrl}</a></p>`;

  return { subject, text, html };
}

export interface SubAccountInvitationEmailParams {
  organizationName: string;
  inviterName: string;
  invitationId: string;
  expiresAt: Date;
  appUrl: string;
  websiteUrl: string;
}

export function getSubAccountInvitationEmail(
  params: SubAccountInvitationEmailParams
): {
  subject: string;
  text: string;
  html: string;
} {
  const { organizationName, inviterName, invitationId, expiresAt, appUrl, websiteUrl } =
    params;
  const registerUrl = `${appUrl}/login?subAccountInvitation=${invitationId}`;
  const expiresFormatted = expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const subject = `${inviterName} invited you as a sub-account on ${organizationName}`;

  const text = `${inviterName} invited you to join ${organizationName} on z3cz.com as a sub-account.

Create your account here: ${registerUrl}

This invite expires on ${expiresFormatted}.

—
z3cz.com · Visual workflow automation
${websiteUrl}`;

  const html = `<p>${inviterName} invited you to join ${organizationName} on z3cz.com as a sub-account.</p>
<p><a href="${registerUrl}">Create sub-account</a></p>
<p>This invite expires on ${expiresFormatted}.</p>
<p>—<br>z3cz.com · Visual workflow automation<br><a href="${websiteUrl}">${websiteUrl}</a></p>`;

  return { subject, text, html };
}
