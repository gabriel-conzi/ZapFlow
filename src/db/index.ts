import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não configurada. Veja o .env.example.");
}

// Uma conexão reaproveitada entre requisições (evita esgotar o pool do Postgres
// em ambiente serverless). `prepare: false` é recomendado para Neon/pgbouncer.
const client = postgres(process.env.DATABASE_URL, { prepare: false });

export const db = drizzle(client, { schema });
