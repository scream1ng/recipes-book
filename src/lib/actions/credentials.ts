"use server";

import { createHash } from "crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/db";
import { signIn } from "@/lib/auth";
import { hashPassword } from "@/lib/auth/password";
import {
  generateResetToken,
  hashResetToken,
  resetTokenExpiry,
  evaluateResetToken,
} from "@/lib/auth/reset-token";
import { sendEmail } from "@/lib/email/send";
import { passwordResetEmail, googleOnlyAccountEmail } from "@/lib/email/templates/password-reset";
import { checkPasswordResetEmailRateLimit, checkPasswordResetIpRateLimit } from "@/lib/ratelimit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const RESET_REQUEST_COOLDOWN_SECONDS = 60;

export interface AuthFormState {
  error?: string;
}

export interface RequestResetState {
  error?: string;
  sent?: boolean;
}

export async function signUpAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!EMAIL_RE.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.create({ data: { email, password: passwordHash } });

  await signIn("credentials", { email, password, redirectTo: "/recipes" });
  return {};
}

export async function signInAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", { email, password, redirectTo: "/recipes" });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Incorrect email or password." };
    }
    throw err;
  }

  return {};
}

export async function requestPasswordResetAction(
  _prevState: RequestResetState,
  formData: FormData
): Promise<RequestResetState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return { error: "Enter a valid email address." };
  }

  const emailKey = createHash("sha256").update(email).digest("hex");
  const hdrs = await headers();
  // x-forwarded-for is "client, proxy1, proxy2, ..." — proxies APPEND, so the first
  // entry is client-supplied and trivially spoofable. Railway sits as a single
  // reverse-proxy hop in front of this app (trustHost: true, per src/lib/auth.ts), so
  // the LAST entry is the one Railway's own edge set — the only segment a client can't
  // forge by sending their own x-forwarded-for header.
  const forwardedFor = hdrs.get("x-forwarded-for");
  const ip = forwardedFor?.split(",").map((s) => s.trim()).filter(Boolean).pop() ?? "unknown";

  // Rate-limited or unknown email: same generic response either way, no enumeration.
  if (!checkPasswordResetEmailRateLimit(emailKey) || !checkPasswordResetIpRateLimit(ip)) {
    return { sent: true };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { sent: true };
  }

  // Restart/instance-proof cooldown — the in-memory bucket above resets on deploy.
  const recentToken = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      usedAt: null,
      createdAt: { gt: new Date(Date.now() - RESET_REQUEST_COOLDOWN_SECONDS * 1000) },
    },
  });
  if (recentToken) {
    return { sent: true };
  }

  if (!user.password) {
    // Google-only account: no password to reset, and no link that would let
    // someone add one without going through the account's real auth method.
    const { subject, text, html } = googleOnlyAccountEmail();
    await sendEmail({ to: email, subject, text, html }).catch((err) => {
      console.error("[password-reset] failed to send Google-only notice:", err);
    });
    return { sent: true };
  }

  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });
  await prisma.passwordResetToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  const rawToken = generateResetToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashResetToken(rawToken),
      expiresAt: resetTokenExpiry(),
      requestIp: ip,
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;
  const { subject, text, html } = passwordResetEmail(resetUrl);
  await sendEmail({ to: email, subject, text, html }).catch((err) => {
    console.error("[password-reset] failed to send reset email:", err);
  });

  return { sent: true };
}

export type VerifyTokenResult = "valid" | "expired" | "used" | "unknown";

export async function verifyResetToken(rawToken: string): Promise<VerifyTokenResult> {
  if (!rawToken) return "unknown";

  const token = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(rawToken) },
  });
  if (!token) return "unknown";

  return evaluateResetToken(token);
}

export async function resetPasswordAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const rawToken = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  const token = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(rawToken) },
  });
  if (!token || evaluateResetToken(token) !== "valid") {
    return { error: "This link has expired or already been used. Request a new one." };
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: token.userId },
      data: { password: passwordHash, passwordChangedAt: new Date() },
    }),
    prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { userId: token.userId, usedAt: null },
    }),
  ]);

  redirect("/signin?reset=1");
}
