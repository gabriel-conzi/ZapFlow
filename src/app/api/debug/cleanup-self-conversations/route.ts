import { NextResponse } from "next/server";
import { db } from "@/db";
import { contacts, facebookPages, instagramAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentWorkspace } from "@/lib/workspace";

// Rota de limpeza única (15/08/2026): até a correção de
// isOwnConnectedInstagramSender()/isOwnConnectedFacebookSender(), o sistema
// tratava outra conta conectada do próprio Gabriel como se fosse um contato
// real quando ela mandava Direct/Messenger pra outra conta dele — isso criou
// contatos e conversas "fantasma" (ex: @usepostflow conversando sozinho com
// @fuxica_aqui, centenas de mensagens). Essa rota apaga só esses contatos
// fantasma (apagar o contato já apaga em cascata a conversa, as mensagens e
// qualquer execução de automação ligada a ele — não mexe em nenhum contato
// real). Protegida pelo mesmo login do painel, mesmo padrão de
// /api/debug/merge-duplicate-conversations.
export async function GET() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const [ownInstagramIds, ownFacebookIds] = await Promise.all([
    db.select({ igUserId: instagramAccounts.igUserId }).from(instagramAccounts).where(eq(instagramAccounts.workspaceId, workspace.id)),
    db.select({ pageId: facebookPages.pageId }).from(facebookPages).where(eq(facebookPages.workspaceId, workspace.id)),
  ]);

  const ownIds = new Set<string>([
    ...ownInstagramIds.map((r) => r.igUserId),
    ...ownFacebookIds.map((r) => r.pageId),
  ]);

  const allContacts = await db
    .select({ id: contacts.id, igScopedId: contacts.igScopedId, name: contacts.name, username: contacts.username })
    .from(contacts)
    .where(eq(contacts.workspaceId, workspace.id));

  const ghosts = allContacts.filter((c) => ownIds.has(c.igScopedId));

  for (const ghost of ghosts) {
    await db.delete(contacts).where(eq(contacts.id, ghost.id));
  }

  return NextResponse.json({
    removed: ghosts.length,
    removedContacts: ghosts.map((g) => ({ name: g.name, username: g.username })),
  });
}
