import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";

// ─────────────────────────────────────────────────────────────────────────
// AUTENTICAÇÃO (tabelas exigidas pelo Auth.js / Drizzle Adapter)
// ─────────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("password_hash"), // null se o login for só via Google
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  emailIdx: uniqueIndex("users_email_idx").on(table.email),
}));

export const accounts = pgTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationTokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// ─────────────────────────────────────────────────────────────────────────
// WORKSPACES (preparado para multiempresa no futuro; hoje 1 workspace = 1 usuário)
// ─────────────────────────────────────────────────────────────────────────

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  plan: text("plan").notNull().default("free"), // free | pro | agency (futuro/Stripe)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("owner"), // owner | admin | member
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.workspaceId, t.userId] }),
  })
);

// ─────────────────────────────────────────────────────────────────────────
// CONTAS DE INSTAGRAM CONECTADAS
// ─────────────────────────────────────────────────────────────────────────

export const instagramAccounts = pgTable("instagram_accounts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  igUserId: text("ig_user_id").notNull(), // ID da conta comercial do Instagram
  igUsername: text("ig_username"),
  pageId: text("page_id").notNull(), // Página do Facebook vinculada (obrigatório p/ Graph API)
  pageName: text("page_name"),
  accessToken: text("access_token").notNull(), // token de página, longa duração
  tokenExpiresAt: timestamp("token_expires_at"),
  connected: boolean("connected").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────────────────────────────────
// CONTATOS / CRM
// ─────────────────────────────────────────────────────────────────────────

export const contacts = pgTable("contacts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  instagramAccountId: text("instagram_account_id").references(() => instagramAccounts.id, { onDelete: "cascade" }),
  igScopedId: text("ig_scoped_id").notNull(), // ID do usuário do IG (escopado por conta)
  name: text("name"),
  username: text("username"),
  profilePicUrl: text("profile_pic_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastInteractionAt: timestamp("last_interaction_at").defaultNow().notNull(),
});

export const tags = pgTable("tags", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6C5CE7"),
});

export const contactTags = pgTable(
  "contact_tags",
  {
    contactId: text("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
    tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.contactId, t.tagId] }) })
);

// ─────────────────────────────────────────────────────────────────────────
// CONVERSAS E MENSAGENS (Direct + Comentários)
// ─────────────────────────────────────────────────────────────────────────

export const conversations = pgTable("conversations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  contactId: text("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  channel: text("channel").notNull().default("dm"), // dm | comment
  status: text("status").notNull().default("open"), // open | resolved
  unreadCount: integer("unread_count").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  direction: text("direction").notNull(), // inbound | outbound
  sender: text("sender").notNull().default("contact"), // contact | agent | automation | ai
  text: text("text"),
  mediaUrl: text("media_url"),
  igMessageId: text("ig_message_id"),
  automationId: text("automation_id"), // se foi enviada por uma automação
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────────────────────────────────
// AUTOMAÇÕES (construtor visual)
// ─────────────────────────────────────────────────────────────────────────

export const automations = pgTable("automations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  triggerType: text("trigger_type").notNull().default("keyword"), // keyword | welcome | comment | manual
  triggerConfig: jsonb("trigger_config").$type<Record<string, unknown>>().default({}),
  flow: jsonb("flow").$type<{ nodes: unknown[]; edges: unknown[] }>().notNull().default({ nodes: [], edges: [] }),
  status: text("status").notNull().default("draft"), // draft | active | paused
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const automationLogs = pgTable("automation_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  automationId: text("automation_id").notNull().references(() => automations.id, { onDelete: "cascade" }),
  contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  status: text("status").notNull(), // triggered | completed | failed
  detail: text("detail"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO DE IA (prompts por workspace)
// ─────────────────────────────────────────────────────────────────────────

export const aiSettings = pgTable("ai_settings", {
  workspaceId: text("workspace_id").primaryKey().references(() => workspaces.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  systemPrompt: text("system_prompt").default(""),
  model: text("model").notNull().default("gpt-4o-mini"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────────────────────────────────
// ASSINATURA (estrutura pronta para Stripe — não ativo ainda)
// ─────────────────────────────────────────────────────────────────────────

export const subscriptions = pgTable("subscriptions", {
  workspaceId: text("workspace_id").primaryKey().references(() => workspaces.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: text("status").notNull().default("inactive"), // inactive | trialing | active | canceled
  currentPeriodEnd: timestamp("current_period_end"),
});

// ─────────────────────────────────────────────────────────────────────────
// RELAÇÕES
// ─────────────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  workspaces: many(workspaces),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, { fields: [workspaces.ownerId], references: [users.id] }),
  members: many(workspaceMembers),
  instagramAccounts: many(instagramAccounts),
  contacts: many(contacts),
  automations: many(automations),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [contacts.workspaceId], references: [workspaces.id] }),
  instagramAccount: one(instagramAccounts, { fields: [contacts.instagramAccountId], references: [instagramAccounts.id] }),
  conversations: many(conversations),
  tags: many(contactTags),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  contact: one(contacts, { fields: [conversations.contactId], references: [contacts.id] }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
}));
