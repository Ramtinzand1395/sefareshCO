import "server-only";

import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { loginSchema } from "@/src/domain/schemas/auth";
import {
  AccountUnavailableError,
  authenticateWithCredentials,
  authenticateWithGoogle,
} from "@/src/services/auth-service";

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

const googleIsConfigured = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

export const authOptions: NextAuthConfig = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    ...(googleIsConfigured
      ? [Google({ allowDangerousEmailAccountLinking: true })]
      : []),
    Credentials({
      name: "ایمیل و رمز عبور",
      credentials: {
        email: { label: "ایمیل", type: "email" },
        password: { label: "رمز عبور", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        return authenticateWithCredentials(parsed.data.email, parsed.data.password);
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;

      const email = normalizeEmail(user.email);
      const googleProfile = profile as { email_verified?: boolean } | undefined;
      if (!email || googleProfile?.email_verified !== true) return false;

      try {
        const authenticatedUser = await authenticateWithGoogle({
          email,
          providerAccountId: account.providerAccountId,
          name: user.name,
          avatarUrl: user.image,
        });
        Object.assign(user, authenticatedUser);
        return true;
      } catch (error) {
        if (error instanceof AccountUnavailableError) return false;
        throw error;
      }
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.onboardingCompleted = Boolean(user.onboardingCompleted);
        token.isAdmin = Boolean(user.isAdmin);
        token.destination = user.destination ?? "/onboarding";
      }

      if (trigger === "update" && session?.user) {
        token.role = session.user.role ?? token.role;
        token.onboardingCompleted =
          session.user.onboardingCompleted ?? token.onboardingCompleted;
        token.isAdmin = session.user.isAdmin ?? token.isAdmin;
        token.destination = session.user.destination ?? token.destination;
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = String(token.id ?? token.sub ?? "");
      session.user.role = token.role;
      session.user.onboardingCompleted = Boolean(token.onboardingCompleted);
      session.user.isAdmin = Boolean(token.isAdmin);
      session.user.destination = token.destination ?? "/onboarding";
      return session;
    },
  },
  debug: process.env.NEXTAUTH_DEBUG === "true",
};
