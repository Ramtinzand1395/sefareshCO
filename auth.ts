import NextAuth, { type DefaultSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/options";

type Destination = "/onboarding" | "/cafe" | "/supplier" | "/admin";

declare module "next-auth" {
  interface User {
    role?: "cafe" | "supplier" | "admin";
    onboardingCompleted?: boolean;
    isAdmin?: boolean;
    destination?: Destination;
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role?: "cafe" | "supplier" | "admin";
      onboardingCompleted: boolean;
      isAdmin: boolean;
      destination: Destination;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: "cafe" | "supplier" | "admin";
    onboardingCompleted?: boolean;
    isAdmin?: boolean;
    destination?: Destination;
  }
}

export const { handlers, auth, signIn, signOut, unstable_update } =
  NextAuth(authOptions);
