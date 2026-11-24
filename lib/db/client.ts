import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// One local SQLite file for the MVP. Only lib/db knows this.
const file = path.join(process.cwd(), "data", "app.db");

const globalForDb = globalThis as unknown as { __db?: ReturnType<typeof make> };

function make() {
  mkdirSync(path.dirname(file), { recursive: true });
  const client = createClient({ url: `file:${file}` });
  return drizzle(client, { schema });
}

export const db = globalForDb.__db ?? make();
if (process.env.NODE_ENV !== "production") globalForDb.__db = db;

// The MVP has one user. Every row still carries user_id so sign-in slots in later.
export const LOCAL_USER_ID = "local";
