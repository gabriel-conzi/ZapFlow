export const metadata = {
  title: "Política de Privacidade — ZapFlow",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-sm leading-relaxed text-foreground">
      <h1 className="text-2xl font-semibold">Política de Privacidade — ZapFlow</h1>
      <p className="mt-2 text-muted-foreground">Última atualização: agosto de 2026.</p>

      <p className="mt-6">
        O ZapFlow é uma ferramenta de uso pessoal que se conecta à conta comercial do Instagram do
        seu proprietário (@usepostflow) através do login oficial da Meta, para organizar e
        responder mensagens de Direct em um só lugar.
      </p>

      <h2 className="mt-8 text-base font-semibold">Quais dados coletamos</h2>
      <p className="mt-2">Ao conectar uma conta do Instagram, o ZapFlow acessa e armazena:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>ID, nome de usuário e foto de perfil da conta comercial conectada;</li>
        <li>
          ID, nome de usuário e foto de perfil das pessoas que enviam mensagens de Direct pra essa
          conta;
        </li>
        <li>O conteúdo das mensagens trocadas (texto e anexos) via Direct;</li>
        <li>O token de acesso emitido pela Meta, usado para ler e enviar mensagens.</li>
      </ul>

      <h2 className="mt-8 text-base font-semibold">Como usamos esses dados</h2>
      <p className="mt-2">
        Os dados são usados exclusivamente para exibir as conversas na Inbox do ZapFlow, permitir
        respostas manuais e, futuramente, automações configuradas pelo próprio proprietário da
        conta. Não vendemos, alugamos nem compartilhamos esses dados com terceiros. O único
        serviço externo envolvido é a própria API da Meta/Instagram, usada para enviar e receber
        as mensagens.
      </p>

      <h2 className="mt-8 text-base font-semibold">Armazenamento e segurança</h2>
      <p className="mt-2">
        Os dados ficam em um banco de dados PostgreSQL hospedado pela Neon, com conexão
        criptografada. O acesso ao painel do ZapFlow exige login com senha ou Google.
      </p>

      <h2 className="mt-8 text-base font-semibold">Retenção e exclusão</h2>
      <p className="mt-2">
        Os dados de uma conta do Instagram e das conversas associadas são mantidos enquanto a
        conexão estiver ativa. Para solicitar a exclusão de qualquer dado — seu ou de uma conversa
        específica — entre em contato pelo e-mail abaixo.
      </p>

      <h2 className="mt-8 text-base font-semibold">Contato</h2>
      <p className="mt-2">
        Dúvidas sobre esta política ou pedidos de exclusão de dados: {" "}
        <a className="text-primary underline" href="mailto:engpalomaconzi84@gmail.com">
          engpalomaconzi84@gmail.com
        </a>
        .
      </p>
    </div>
  );
}
