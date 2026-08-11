export const metadata = {
  title: "Termos de Serviço — ZapFlow",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-sm leading-relaxed text-foreground">
      <h1 className="text-2xl font-semibold">Termos de Serviço — ZapFlow</h1>
      <p className="mt-2 text-muted-foreground">Última atualização: agosto de 2026.</p>

      <p className="mt-6">
        O ZapFlow é uma ferramenta de uso pessoal, desenvolvida e operada por Gabriel, para
        organizar e responder mensagens de Direct da conta comercial do Instagram
        @usepostflow. Não é oferecido como produto para terceiros.
      </p>

      <h2 className="mt-8 text-base font-semibold">Uso do serviço</h2>
      <p className="mt-2">
        O acesso ao ZapFlow é restrito ao proprietário da conta e a quem ele autorizar
        diretamente. Ao conectar uma conta do Instagram via login oficial da Meta, você autoriza
        o ZapFlow a ler e enviar mensagens de Direct em nome dessa conta, conforme descrito na{" "}
        <a className="text-primary underline" href="/privacidade">
          Política de Privacidade
        </a>
        .
      </p>

      <h2 className="mt-8 text-base font-semibold">Limitação de responsabilidade</h2>
      <p className="mt-2">
        O serviço é fornecido &quot;como está&quot;, sem garantias. O funcionamento depende da
        disponibilidade e das políticas da API da Meta/Instagram, que podem mudar sem aviso
        prévio.
      </p>

      <h2 className="mt-8 text-base font-semibold">Contato</h2>
      <p className="mt-2">
        Dúvidas sobre estes termos: {" "}
        <a className="text-primary underline" href="mailto:engpalomaconzi84@gmail.com">
          engpalomaconzi84@gmail.com
        </a>
        .
      </p>
    </div>
  );
}
