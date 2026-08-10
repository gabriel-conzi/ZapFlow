import { NextResponse } from "next/server";

// Verificação inicial exigida pela Meta ao cadastrar a URL do webhook no
// Meta Developer (Products → Webhooks → Instagram). Veja o README.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// Recebe os eventos em tempo real (mensagens, comentários). Na Fase 1 só
// confirmamos o recebimento (a Meta exige resposta 200 em até 20s) e
// registramos no log do servidor — o processamento completo (salvar
// conversa, disparar automação) entra na Fase 3.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  console.log("[instagram/webhook] evento recebido:", JSON.stringify(body));
  return NextResponse.json({ received: true });
}
