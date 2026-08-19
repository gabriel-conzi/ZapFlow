import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import Link from "next/link";
import {
  LayoutDashboard,
  Inbox,
  Users,
  Workflow,
  Package,
  TrendingUp,
  Settings,
  CreditCard,
  Camera,
  LogOut,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/contacts", label: "Contatos", icon: Users },
  { href: "/automations", label: "Automações", icon: Workflow },
  { href: "/products", label: "Produtos", icon: Package },
  { href: "/sales", label: "Vendas", icon: TrendingUp },
  { href: "/settings", label: "Configurações", icon: Settings },
  { href: "/billing", label: "Assinatura", icon: CreditCard },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const initials = (session.user?.name || session.user?.email || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex h-screen w-full overflow-hidden bg-muted/30">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-background">
        <div className="flex items-center justify-between gap-2 px-5 py-5">
          <div className="flex items-center gap-2 font-semibold">
            <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-primary text-white">
              <Camera size={15} />
            </span>
            ZapFlow
          </div>
          <ThemeToggle />
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2.5 border-t px-4 py-4">
          <Avatar className="size-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{session.user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{session.user?.email}</p>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="ghost" size="icon" title="Sair">
              <LogOut size={15} />
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
