// Função agendada da Netlify — roda a cada minuto e chama nosso endpoint
// interno que retoma automações paradas num nó de "esperar". Fica fora da
// pasta src/app porque funções agendadas são um recurso separado do Next.js
// (não passam pelo plugin @netlify/plugin-nextjs).
//
// Depois do deploy, ative em: Netlify → Logs → Functions → automations-cron
// (é criada automaticamente, não precisa configurar nada manualmente).

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callResume(siteUrl: string, secret: string, attempt: number) {
  try {
    const res = await fetch(`${siteUrl}/api/automations/resume`, {
      method: "POST",
      headers: { "x-cron-secret": secret },
    });
    const data = await res.json().catch(() => null);
    console.log(`[automations-cron] chamada ${attempt}:`, res.status, JSON.stringify(data));
  } catch (err) {
    console.error(`[automations-cron] erro na chamada ${attempt}:`, err);
  }
}

// Funções agendadas da Netlify têm o mínimo de 1x por minuto — mas nada
// impede de fazer várias chamadas espaçadas DENTRO de uma mesma execução.
// Isso reduz a espera real de nós de "esperar" com poucos segundos (sem
// isso, uma espera de 10s podia demorar até 1 minuto pra ser retomada).
// Limite de execução de função agendada é 30s, então ficamos com folga.
const PASSES = 4;
const GAP_MS = 8_000;

const handler = async () => {
  const siteUrl = process.env.URL ?? process.env.DEPLOY_PRIME_URL;
  const secret = process.env.CRON_SECRET;

  if (!siteUrl || !secret) {
    console.error("[automations-cron] faltando URL do site ou CRON_SECRET nas variáveis de ambiente");
    return;
  }

  for (let i = 0; i < PASSES; i++) {
    if (i > 0) await sleep(GAP_MS);
    await callResume(siteUrl, secret, i + 1);
  }
};

export default handler;

export const config = {
  schedule: "* * * * *",
};
