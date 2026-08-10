import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/db";
import { users, workspaces, workspaceMembers } from "@/db/schema";
import { eq } from "drizzle-orm";

const bodySchema = z.object({
  name: z.string().min(2, "Nome muito curto"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres"),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const { name, email, password } = parsed.data;

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return NextResponse.json({ error: "Já existe uma conta com esse e-mail" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [user] = await db.insert(users).values({ name, email, passwordHash }).returning();

  // Cria automaticamente o workspace pessoal do usuário (uso próprio hoje;
  // preparado para virar multiempresa no futuro sem migrar dados).
  const [workspace] = await db
    .insert(workspaces)
    .values({ name: `Workspace de ${name}`, ownerId: user.id })
    .returning();

  await db.insert(workspaceMembers).values({
    workspaceId: workspace.id,
    userId: user.id,
    role: "owner",
  });

  return NextResponse.json({ ok: true });
}
