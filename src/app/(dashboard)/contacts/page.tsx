import { Card, CardContent } from "@/components/ui/card";
import { getCurrentWorkspace } from "@/lib/workspace";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Users } from "lucide-react";
import { OptOutToggle } from "@/components/contacts/opt-out-toggle";

export default async function ContactsPage() {
  const workspace = await getCurrentWorkspace();
  const rows = workspace ? await db.select().from(contacts).where(eq(contacts.workspaceId, workspace.id)) : [];

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">Contatos</h1>
      <p className="mt-1 text-sm text-muted-foreground">{rows.length} contatos.</p>

      {rows.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <Users size={28} />
            <p className="max-w-sm text-sm">
              Seus contatos aparecem aqui automaticamente conforme pessoas interagem com seu Instagram
              (Direct ou comentário).
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-6">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <tbody>
                {rows.map((c) => {
                  const fields = Object.entries((c.customFields as Record<string, string> | null) ?? {});
                  return (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="p-4 font-medium">{c.name ?? c.username ?? c.igScopedId}</td>
                      <td className="p-4 text-muted-foreground">{c.username ? `@${c.username}` : ""}</td>
                      <td className="p-4">
                        {fields.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {fields.map(([key, value]) => (
                              <span
                                key={key}
                                className="rounded border border-cyan-400 bg-cyan-50 px-1.5 py-0.5 text-[11px] text-cyan-700"
                                title={`Capturado pela automação`}
                              >
                                {key}: {value}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <OptOutToggle contactId={c.id} optedOut={c.optedOut} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
