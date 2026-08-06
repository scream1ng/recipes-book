import "server-only";

/**
 * Thin wrapper over Resend's HTTP API — plain fetch, no SDK dependency.
 * Without RESEND_API_KEY configured (e.g. local dev), logs to the console
 * instead of sending, so the flow is exercisable without real email setup.
 */
export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Recipes Book <onboarding@resend.dev>";

  if (!apiKey) {
    console.log(`[email:dev] to=${input.to} subject="${input.subject}"\n${input.text}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to send email: ${res.status} ${body}`);
  }
}
