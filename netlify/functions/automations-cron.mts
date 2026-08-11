// Função agendada da Netlify — roda a cada minuto e chama nosso endpoint
// interno que retoma automações paradas num nó de "esperar". Fica fora da
// pasta src/app porque funções agendadas são um recurso separado do Next.js
// (não passam pelo plugin @netlify/plugin-nextjs).
//
// Depois do deploy, ative em: Netlify → Logs → Functions → automations-cron
// (é criada automaticamente, não precisa configurar nada manualmente).

const handler = async () => {
  const siteUrl = process.env.URL ?? process.env.DEPLOY_PRIME_URL;
  const secret = process.env.CRON_SECRET;

  if (!siteUrl || !secret) {
    console.error("[automations-cron] faltando URL do site ou CRON_SECRET nas variáveis de ambiente");
    return;
  }

  try {
    const res = await fetch(`${siteUrl}/api/automations/resume`, {
      method: "POST",
      headers: { "x-cron-secret": secret },
    });
    const data = await res.json().catch(() => null);
    console.log("[automations-cron] resposta:", res.status, JSON.stringify(data));
  } catch (err) {
    console.error("[automations-cron] erro ao chamar /api/automations/resume:", err);
  }
};

export default handler;

export const config = {
  schedule: "* * * * *",
};
