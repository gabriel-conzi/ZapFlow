import { Card, CardContent } from "@/components/ui/card";
import { getCurrentWorkspace } from "@/lib/workspace";
import { db } from "@/db";
import { contacts, contactFieldDefinitions } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { Users } from "lucide-react";
import { OptOutToggle } from "@/components/contacts/opt-out-toggle";
import { CustomFieldsManager } from "@/components/contacts/custom-fields-manager";
import { ContactFieldCell } from "@/components/contacts/contact-field-cell";
import type { ContactFieldType } from "@/lib/contact-fields";

export default async function ContactsPage() {
  const workspace = await getCurrentWorkspace();

  const rows = workspace ? await db.select().from(contacts).where(eq(contacts.workspaceId, workspace.id)) : [];
  const fieldDefs = workspace
    ? await db
        .select()
        .from(contactFieldDefinitions)
        .where(eq(contactFieldDefinitions.workspaceId, workspace.id))
        .orderBy(asc(contactFieldDefinitions.createdAt))
    : [];

  const definedKeys = new Set(fieldDefs.map((f) => f.key));

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">Contatos</h1>
      <p className="mt-1 text-sm text-muted-foreground">{rows.length} contatos.</p>

      <CustomFieldsManager fields={fieldDefs} />

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
        <Card className="mt-6 overflow-x-auto">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="p-4 font-medium">Nome</th>
                  <th className="p-4 font-medium">Usuário</th>
                  {fieldDefs.map((f) => (
                    <th key={f.id} className="whitespace-nowrap p-4 font-medium">
                      {f.label}
                    </th>
                  ))}
                  <th className="p-4 font-medium">Outros campos</th>
                  <th className="p-4 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const allFields = (c.customFields as Record<string, string> | null) ?? {};
                  const extraFields = Object.entries(allFields).filter(([key]) => !definedKeys.has(key));
                  return (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="whitespace-nowrap p-4 font-medium">
                        {c.name ?? c.username ?? c.igScopedId}
                      </td>
                      <td className="whitespace-nowrap p-4 text-muted-foreground">
                        {c.username ? `@${c.username}` : ""}
                      </td>
                      {fieldDefs.map((f) => (
                        <td key={f.id} className="p-4">
                          <ContactFieldCell
                            contactId={c.id}
                            fieldKey={f.key}
                            fieldType={f.type as ContactFieldType}
                            initialValue={allFields[f.key] ?? ""}
                          />
                        </td>
                      ))}
                      <td className="p-4">
                        {extraFields.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {extraFields.map(([key, value]) => (
                              <span
                                key={key}
                                className="rounded border border-cyan-400 bg-cyan-50 px-1.5 py-0.5 text-[11px] text-cyan-700"
                                title="Capturado por uma automação — crie um campo com esse nome acima pra poder editar aqui"
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
