// Modelos prontos oferecidos na galeria que abre ao clicar em "Nova
// automação" (ver components/automations/template-gallery.tsx). Cada modelo
// é só um `flow` pré-pronto — o mesmo formato que o editor já salva —,
// então escolher um modelo é equivalente a duplicar uma automação de
// exemplo: cria uma automação nova (sempre como rascunho) já com esse
// fluxo, pronta pra revisar e ajustar o texto antes de ativar.

import type { AutomationFlow, TriggerNodeData } from "@/lib/automation-types";

export type AutomationTemplate = {
  id: string;
  name: string;
  description: string;
  triggerType: TriggerNodeData["triggerType"];
  flow: AutomationFlow;
};

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: "auto-reply-dm",
    name: "Responder toda DM automaticamente",
    description: "Manda uma mensagem de boas-vindas assim que alguém te chama no Direct pela 1ª vez.",
    triggerType: "welcome",
    flow: {
      nodes: [
        { id: "trigger", type: "trigger", position: { x: 0, y: 0 }, data: { triggerType: "welcome" } },
        {
          id: "msg-boas-vindas",
          type: "sendMessage",
          position: { x: 0, y: 160 },
          data: {
            text: "Oi! Tudo bem? 😊 Muito obrigado por chamar por aqui — em breve alguém do nosso time te responde!",
            buttons: [],
          },
        },
      ],
      edges: [{ id: "e1", source: "trigger", target: "msg-boas-vindas" }],
    },
  },
  {
    id: "comment-to-link",
    name: "Enviar link quando comentar uma palavra",
    description: "Quando alguém comenta uma palavra-chave num post, manda o link automaticamente na DM.",
    triggerType: "comment",
    flow: {
      nodes: [
        {
          id: "trigger",
          type: "trigger",
          position: { x: 0, y: 0 },
          data: { triggerType: "comment", keywords: ["quero"] },
        },
        {
          id: "msg-link",
          type: "sendMessage",
          position: { x: 0, y: 160 },
          data: {
            text: "Aqui está o link que você pediu 👇",
            buttons: [{ id: "btn-link", kind: "link", label: "Acessar", url: "https://seusite.com" }],
          },
        },
      ],
      edges: [{ id: "e1", source: "trigger", target: "msg-link" }],
    },
  },
  {
    id: "faq-keyword",
    name: "Responder perguntas frequentes",
    description: "Dispara uma resposta pronta quando o contato manda uma palavra como 'preço' ou 'valor'.",
    triggerType: "keyword",
    flow: {
      nodes: [
        {
          id: "trigger",
          type: "trigger",
          position: { x: 0, y: 0 },
          data: { triggerType: "keyword", keywords: ["preço", "valor", "quanto custa"] },
        },
        {
          id: "msg-resposta",
          type: "sendMessage",
          position: { x: 0, y: 160 },
          data: {
            text: "Ótima pergunta! Nossos planos começam em R$ 000/mês. Quer que eu te explique os detalhes?",
            buttons: [],
          },
        },
      ],
      edges: [{ id: "e1", source: "trigger", target: "msg-resposta" }],
    },
  },
  {
    id: "capture-name-before-offer",
    name: "Captar nome antes de enviar oferta",
    description: "Pergunta o nome do contato, guarda a resposta, e só depois manda a oferta já usando o nome dele.",
    triggerType: "keyword",
    flow: {
      nodes: [
        {
          id: "trigger",
          type: "trigger",
          position: { x: 0, y: 0 },
          data: { triggerType: "keyword", keywords: ["oferta", "promoção"] },
        },
        {
          id: "collect-nome",
          type: "collectData",
          position: { x: 0, y: 160 },
          data: { question: "Que bom que você quer saber mais! Antes, me conta seu nome?", fieldName: "nome" },
        },
        {
          id: "msg-oferta",
          type: "sendMessage",
          position: { x: 0, y: 320 },
          data: { text: "Prazer, {{nome}}! Aqui está nossa oferta especial: [descreva a oferta aqui] 🎉", buttons: [] },
        },
      ],
      edges: [
        { id: "e1", source: "trigger", target: "collect-nome" },
        { id: "e2", source: "collect-nome", target: "msg-oferta" },
      ],
    },
  },
  {
    id: "menu-with-buttons",
    name: "Menu com botões (ramificação)",
    description: "Manda um menu com opções — cada botão que o contato escolher leva pra uma resposta diferente.",
    triggerType: "keyword",
    flow: {
      nodes: [
        {
          id: "trigger",
          type: "trigger",
          position: { x: 0, y: 0 },
          data: { triggerType: "keyword", keywords: ["menu", "opções"] },
        },
        {
          id: "msg-menu",
          type: "sendMessage",
          position: { x: 0, y: 160 },
          data: {
            text: "Escolha uma opção pra eu te ajudar melhor 👇",
            buttons: [
              { id: "opt-precos", kind: "reply", label: "Preços" },
              { id: "opt-suporte", kind: "reply", label: "Suporte" },
            ],
          },
        },
        {
          id: "msg-precos",
          type: "sendMessage",
          position: { x: -140, y: 320 },
          data: { text: "Nossos planos começam em R$ 000/mês. Quer que eu te mande mais detalhes?", buttons: [] },
        },
        {
          id: "msg-suporte",
          type: "sendMessage",
          position: { x: 140, y: 320 },
          data: { text: "Nosso suporte responde em até 24h. Me conta o que está acontecendo que eu te ajudo!", buttons: [] },
        },
      ],
      edges: [
        { id: "e1", source: "trigger", target: "msg-menu" },
        { id: "e2", source: "msg-menu", sourceHandle: "opt-precos", target: "msg-precos" },
        { id: "e3", source: "msg-menu", sourceHandle: "opt-suporte", target: "msg-suporte" },
      ],
    },
  },
];
