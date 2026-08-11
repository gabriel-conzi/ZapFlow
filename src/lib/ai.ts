import { db } from "@/db";
import { aiSettings, messages } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const DEFAULT_SYSTEM_PROMPT =
  "Você é um assistente de atendimento simpático e objetivo, respondendo em nome de uma empresa " +
  "pelo Direct do Instagram/Facebook. Responda sempre em português do Brasil, de forma breve (no " +
  "máximo 3-4 frases) e sem inventar informações que você não tem (preços, prazos, políticas) — " +
  "nesses casos, diga que vai confirmar com a equipe.";

export async function getAiSettings(workspaceId: string) {
  const [row] = await db.select().from(aiSettings).where(eq(aiSettings.workspaceId, workspaceId)).limit(1);
  return row ?? null;
}

/**
 * Gera uma resposta com IA pra continuar a conversa, usando o prompt
 * configurado em Configurações e as últimas mensagens como contexto. Retorna
 * null (sem quebrar nada) se a IA estiver desativada, sem chave configurada,
 * ou se a chamada à OpenAI falhar por qualquer motivo.
 */
export async function generateAiReply(params: {
  workspaceId: string;
  conversationId: string;
}): Promise<string | null> {
  const settings = await getAiSettings(params.workspaceId);
  if (!settings?.enabled) return null;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[ai] OPENAI_API_KEY não configurada");
    return null;
  }

  const history = await db
    .select({ sender: messages.sender, text: messages.text, direction: messages.direction })
    .from(messages)
    .where(eq(messages.conversationId, params.conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(10);

  const chatMessages = [
    { role: "system" as const, content: settings.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT },
    ...history
      .reverse()
      .filter((m) => m.text?.trim())
      .map((m) => ({
        role: m.direction === "inbound" ? ("user" as const) : ("assistant" as const),
        content: m.text as string,
      })),
  ];

  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: settings.model || "gpt-4o-mini",
        messages: chatMessages,
        max_tokens: 400,
        temperature: 0.7,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message ?? "Erro na OpenAI");
    const reply = data.choices?.[0]?.message?.content?.trim();
    return reply || null;
  } catch (err) {
    console.error("[ai] erro ao gerar resposta:", err);
    return null;
  }
}
