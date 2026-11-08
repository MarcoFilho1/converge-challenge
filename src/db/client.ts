import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as { __consultorioDb?: Db; __consultorioDbUrl?: string };

function createDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definido");
  const client = postgres(url, { max: 5, onnotice: () => {} });
  return drizzle(client, { schema });
}

export const db: Db =
  globalForDb.__consultorioDb && globalForDb.__consultorioDbUrl === process.env.DATABASE_URL
    ? globalForDb.__consultorioDb
    : (globalForDb.__consultorioDb = createDb());
globalForDb.__consultorioDbUrl = process.env.DATABASE_URL;
