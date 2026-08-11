import { NextResponse } from "next/server";
import { db } from "@/db";
import { automations } from "@/db/schema";
import { getCurrentWorkspace } from "@/lib/workspace";
import type { AutomationFlow } from "@/lib/automation-types";

// Cria (uma única vez, sob demanda) a automação de vendas do UsePostFlow:
// comentário "EU QUERO" em post/reels → resposta privada com um botão pra
// conhecer os planos → marca o contato com a tag "interessado-planos".
// Fica em rascunho — o dono revisa o texto e ativa manualmente.
export async function GET(req: Request) {
  const { origin } = new URL(req.url);
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.redirect(`${origin}/login`);

  const messageText = [
    "Oi! 🚀 Que bom que você quer levar o UsePostFlow pro seu negócio!",
    "",
    "A gente tem planos a partir de R$97/mês, com 7 dias de garantia — devolução total se não curtir.",
    "",
    "Dá uma olhada e escolhe o que faz mais sentido pra você:",
  ].join("\n");

  const flow: AutomationFlow = {
    nodes: [
      {
        id: "trigger",
        type: "trigger",
        position: { x: 0, y: 0 },
        data: { triggerType: "comment", keywords: ["eu quero"] },
      },
      {
        id: "condition-1",
        type: "condition",
        position: { x: 0, y: 160 },
        data: { tagName: "interessado-planos" },
      },
      {
        id: "send-1",
        type: "sendMessage",
        position: { x: -120, y: 340 },
        data: {
          text: messageText,
          buttonText: "Ver planos",
          buttonUrl: "https://usepostflow.com/#precos",
        },
      },
      {
        id: "tag-1",
        type: "addTag",
        position: { x: -120, y: 520 },
        data: { tagName: "interessado-planos" },
      },
    ],
    edges: [
      { id: "e1", source: "trigger", target: "condition-1" },
      // "Não" (ainda não tem a tag) -> manda a mensagem normalmente
      { id: "e2", source: "condition-1", target: "send-1", sourceHandle: "no" },
      { id: "e3", source: "send-1", target: "tag-1" },
      // "Sim" (já tem a tag) -> fluxo termina aqui, sem reenviar a mensagem
    ],
  };

  const [created] = await db
    .insert(automations)
    .values({
      workspaceId: workspace.id,
      name: "Vendas — comentário EU QUERO",
      triggerType: "comment",
      triggerConfig: { keywords: ["eu quero"] },
      flow,
      status: "draft",
    })
    .returning();

  return NextResponse.redirect(`${origin}/automations/${created.id}`);
}
