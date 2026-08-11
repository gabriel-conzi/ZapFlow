// Formato do fluxo salvo em automations.flow (jsonb). Compartilhado entre o
// motor de execução (lib/automations.ts) e o editor visual (canvas).

export type Position = { x: number; y: number };

export type TriggerNodeData = {
  label?: string;
  triggerType: "keyword" | "welcome";
  // usado só quando triggerType === "keyword" — dispara se a mensagem
  // recebida contiver qualquer uma dessas palavras (sem diferenciar maiúscula/minúscula)
  keywords?: string[];
};

export type SendMessageNodeData = {
  label?: string;
  text: string;
};

export type DelayNodeData = {
  label?: string;
  amount: number;
  unit: "minutes" | "hours" | "days";
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

// sourceHandle é usado só pelo nó de condição: "yes" | "no". Nos demais nós,
// cada um tem no máximo uma saída, então sourceHandle fica undefined/null.
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
