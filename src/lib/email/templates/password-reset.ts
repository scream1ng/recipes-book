import { RESET_TOKEN_TTL_MINUTES } from "@/lib/auth/reset-token";

/** For accounts that have a password — carries the actual reset link. */
export function passwordResetEmail(resetUrl: string) {
  return {
    subject: "Reset your Recipes Book password",
    text: `We received a request to reset your Recipes Book password. Open this link to choose a new one (expires in ${RESET_TOKEN_TTL_MINUTES} minutes, single use):\n\n${resetUrl}\n\nDidn't request this? You can safely ignore this email — your password won't change.`,
    html: `
      <p>We received a request to reset your Recipes Book password. Click below to choose a new one — this link expires in ${RESET_TOKEN_TTL_MINUTES} minutes and can only be used once.</p>
      <p><a href="${resetUrl}" style="display:inline-block;background:#B84A6C;color:#fff;text-decoration:none;font-weight:600;padding:11px 22px;border-radius:999px;">Reset password</a></p>
      <p style="font-size:12px;color:#7E6E69;word-break:break-all;">${resetUrl}</p>
      <p style="font-size:12px;color:#7E6E69;">Didn't request this? You can safely ignore this email — your password won't change.</p>
    `.trim(),
  };
}

/** For Google-only accounts — no link, since there's no password to reset. */
export function googleOnlyAccountEmail() {
  return {
    subject: "About your Recipes Book sign-in",
    text: `Someone requested a password reset for this email, but this account signs in with Google — it has no password to reset. Use the "Sign in with Google" button on the sign-in page instead.\n\nDidn't request this? You can safely ignore this email.`,
    html: `
      <p>Someone requested a password reset for this email, but this account signs in with <b>Google</b> — it has no password to reset.</p>
      <p>Use the "Sign in with Google" button on the sign-in page instead.</p>
      <p style="font-size:12px;color:#7E6E69;">Didn't request this? You can safely ignore this email.</p>
    `.trim(),
  };
}
