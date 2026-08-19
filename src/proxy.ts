import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/api/auth",
  "/api/register",
  "/api/instagram/webhook",
  "/api/facebook/webhook",
  "/api/telegram/webhook",
  "/api/email/webhook",
  "/privacidade",
  "/termos",
  "/excluir-dados",
  "/api/automations/resume",
  // link curto rastreável de produto (ver src/app/r/[slug]/route.ts) — quem
  // clica não está logado no ZapFlow, então precisa ficar público.
  "/r/",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!req.auth && !isPublic) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
