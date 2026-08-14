import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/session-provider";

export const metadata: Metadata = {
  title: "ZapFlow — Automação de Instagram",
  description: "Automação de mensagens, comentários e fluxos de conversa para Instagram.",
};

// Roda antes da página pintar na tela, pra já aplicar o tema escuro salvo
// (ou a preferência do sistema) sem dar aquele "pisca" de claro→escuro.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("zapflow-theme");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
