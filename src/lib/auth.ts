import { redirect } from "next/navigation";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";

const hasGoogleCreds = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // Railway (and most non-Vercel hosts) sit behind a reverse proxy, so
  // Auth.js needs explicit permission to trust the forwarded host header.
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.password) return null;

        const valid = await verifyPassword(password, user.password);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
    ...(hasGoogleCreds
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  // Credentials sign-in isn't compatible with the adapter's database session
  // strategy, so sessions are JWT-based (the adapter is still used to
  // persist OAuth accounts/users when Google is configured).
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
});

/**
 * Server-side helper for actions/routes: returns the current user's id,
 * ensuring a UserSettings row exists (created lazily on first use).
 * Throws if there is no authenticated session.
 */
export async function requireUser() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/signin");
  }

  await prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  return userId;
}

export const authConfigured = true;
export const googleConfigured = hasGoogleCreds;
