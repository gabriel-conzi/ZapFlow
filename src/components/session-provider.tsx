"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { Toaster } from "sonner";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      {children}
      <Toaster richColors position="top-right" />
    </NextAuthSessionProvider>
  );
}
