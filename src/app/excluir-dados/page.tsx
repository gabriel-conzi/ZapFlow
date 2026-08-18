export const metadata = {
  title: "Como excluir seus dados — ZapFlow",
};

export default function DataDeletionPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-sm leading-relaxed text-foreground">
      <h1 className="text-2xl font-semibold">Como excluir seus dados</h1>
      <p className="mt-2 text-muted-foreground">Última atualização: agosto de 2026.</p>

      <p className="mt-6">
        O ZapFlow é uma ferramenta de uso pessoal que se conecta a contas comerciais do
        Instagram/Facebook através do login oficial da Meta, para organizar e responder
        mensagens e comentários em um só lugar. Esta página explica como qualquer pessoa pode
        pedir a exclusão dos seus dados guardados pelo ZapFlow.
      </p>

      <h2 className="mt-8 text-base font-semibold">Quem pode pedir exclusão</h2>
      <p className="mt-2">
        Qualquer pessoa que já trocou uma mensagem de Direct/Messenger ou comentou em uma
        publicação de uma conta conectada ao ZapFlow pode solicitar a exclusão dos dados
        guardados sobre essa interação (nome, nome de usuário, foto de perfil, e o conteúdo das
        mensagens/comentários trocados).
      </p>

      <h2 className="mt-8 text-base font-semibold">Como solicitar</h2>
      <p className="mt-2">
        Envie um e-mail para{" "}
        <a className="text-primary underline" href="mailto:suporte@usepostflow.com">
          suporte@usepostflow.com
        </a>{" "}
        a partir do mesmo Instagram/Facebook usado na conversa (ou informando o
        @usuário/nome usado), pedindo a exclusão. O pedido é confirmado por e-mail e os dados
        correspondentes — perfil do contato e o histórico de mensagens/comentários com ele —
        são apagados do banco de dados do ZapFlow em até 30 dias.
      </p>

      <h2 className="mt-8 text-base font-semibold">O que NÃO é apagado automaticamente</h2>
      <p className="mt-2">
        Esse pedido apaga os dados guardados no ZapFlow. Ele não afeta mensagens ou comentários
        que continuam existindo no próprio Instagram/Facebook — isso é gerenciado diretamente
        pela Meta, nas configurações da sua conta.
      </p>

      <h2 className="mt-8 text-base font-semibold">Mais detalhes</h2>
      <p className="mt-2">
        Para saber quais dados o ZapFlow coleta e como eles são usados e armazenados, veja a{" "}
        <a className="text-primary underline" href="/privacidade">
          Política de Privacidade
        </a>
        .
      </p>
    </div>
  );
}
