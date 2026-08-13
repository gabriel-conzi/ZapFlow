// Formato do fluxo salvo em automations.flow (jsonb). Compartilhado entre o
// motor de execução (lib/automations.ts) e o editor visual (canvas).

export type Position = { x: number; y: number };

export type TriggerNodeData = {
  label?: string;
  triggerType: "keyword" | "welcome" | "comment";
  // usado quando triggerType é "keyword" (mensagem de Direct) ou "comment"
  // (comentário em post/reels) — dispara se o texto contiver qualquer uma
  // dessas palavras (sem diferenciar maiúscula/minúscula)
  keywords?: string[];
  // usado só quando triggerType === "comment" — se preenchido, essa
  // automação só dispara pra comentários NESSE post/reels específico (evita
  // conflito entre automações diferentes que usam a mesma palavra-chave em
  // posts diferentes). Deixe em branco pra valer em qualquer post.
  mediaId?: string;
  mediaLabel?: string; // legenda curta só pra exibir no editor
};

// Limite da própria Meta pro "button template" do Instagram/Messenger: no
// máximo 3 botões por mensagem (misturando links e botões de ramificação).
export const MAX_MESSAGE_BUTTONS = 3;

export type MessageButtonData = {
  // usado como sourceHandle da aresta que sai desse botão específico, quando
  // kind === "reply" — precisa ser estável (não mudar depois de criado, senão
  // a conexão no editor se perde).
  id: string;
  // "link": abre uma URL (não pausa nem ramifica o fluxo — a automação
  // continua normalmente pela saída padrão do nó, como antes).
  // "reply": não abre nada — pausa a automação até o contato apertar um dos
  // botões de "reply" da mensagem, e cada um leva a uma aresta/caminho
  // diferente (a saída padrão do nó deixa de valer quando há botão "reply").
  kind: "link" | "reply";
  label: string;
  url?: string; // obrigatório só quando kind === "link"
};

export type SendMessageNodeData = {
  label?: string;
  text: string;
  // até MAX_MESSAGE_BUTTONS botões, misturando "link" e "reply" à vontade.
  buttons?: MessageButtonData[];
  // campos antigos (de antes de existir `buttons`) — mantidos só pra
  // automações salvas nesse formato continuarem funcionando. Não usar em
  // código novo: use `buttons` e a função `getMessageButtons`.
  buttonText?: string;
  buttonUrl?: string;
};

/** Devolve a lista de botões de um nó de "Enviar mensagem" já normalizada,
 * migrando o campo antigo (buttonText/buttonUrl, de antes de existirem
 * botões múltiplos/de ramificação) pra dentro de `buttons` quando for o
 * caso. Use isso em vez de ler `data.buttons` direto. */
export function getMessageButtons(data: SendMessageNodeData): MessageButtonData[] {
  if (data.buttons?.length) return data.buttons;
  if (data.buttonText?.trim() && data.buttonUrl?.trim()) {
    return [{ id: "legacy-link", kind: "link", label: data.buttonText, url: data.buttonUrl }];
  }
  return [];
}

/** true se a mensagem tem pelo menos 1 botão de ramificação — nesse caso a
 * automação pausa depois de enviar, esperando o contato escolher uma opção,
 * em vez de seguir direto pela saída padrão do nó. */
export function hasReplyButtons(data: SendMessageNodeData): boolean {
  return getMessageButtons(data).some((b) => b.kind === "reply");
}

// Formato de botão que a Graph API (Instagram/Messenger) espera dentro de um
// "button template" — usado por sendInstagramMessage/sendFacebookMessage.
// "web_url" abre um link; "postback" volta pro nosso webhook com `payload`
// quando o contato aperta (é o que usamos pra ramificar o fluxo).
export type SendableButton =
  | { type: "web_url"; title: string; url: string }
  | { type: "postback"; title: string; payload: string };

/** Converte os botões salvos num nó de "Enviar mensagem" pro formato que a
 * Graph API espera — "reply" vira "postback" com o próprio id do botão como
 * payload (é assim que reconhecemos qual botão foi apertado quando a
 * resposta chegar no webhook). */
export function toSendableButtons(data: SendMessageNodeData): SendableButton[] {
  return getMessageButtons(data).flatMap((b): SendableButton[] => {
    if (b.kind === "link") {
      return b.url?.trim() ? [{ type: "web_url", title: b.label || "Abrir", url: b.url }] : [];
    }
    return [{ type: "postback", title: b.label || "Continuar", payload: b.id }];
  });
}

export type DelayNodeData = {
  label?: string;
  amount: number;
  unit: "seconds" | "minutes" | "hours" | "days";
};

export type AddTagNodeData = {
  label?: string;
  tagName: string;
};

export type ConditionNodeData = {
  label?: string;
  tagName: string;
};

export type FlowNode =
  | { id: string; type: "trigger"; position: Position; data: TriggerNodeData }
  | { id: string; type: "sendMessage"; position: Position; data: SendMessageNodeData }
  | { id: string; type: "delay"; position: Position; data: DelayNodeData }
  | { id: string; type: "addTag"; position: Position; data: AddTagNodeData }
  | { id: string; type: "condition"; position: Position; data: ConditionNodeData };

export type FlowNodeType = FlowNode["type"];

// sourceHandle é usado pelo nó de condição ("yes" | "no") e pelo nó de
// "Enviar mensagem" quando tem botão de ramificação (o id do botão). Nos
// demais nós, cada um tem no máximo uma saída, então sourceHandle fica
// undefined/null.
export type FlowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
};

export type AutomationFlow = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};

export function emptyFlowWithTrigger(triggerType: TriggerNodeData["triggerType"] = "keyword"): AutomationFlow {
  return {
    nodes: [
      {
        id: "trigger",
        type: "trigger",
        position: { x: 0, y: 0 },
        data: { triggerType, keywords: triggerType === "keyword" ? [] : undefined },
      },
    ],
    edges: [],
  };
}
