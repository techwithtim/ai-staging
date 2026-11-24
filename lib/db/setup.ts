import path from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db, LOCAL_USER_ID } from "./client";
import { users } from "./schema";

// Runs once when the server starts (instrumentation.ts): apply migrations, seed the local user.
export async function setupDatabase() {
  await db.run("PRAGMA journal_mode = WAL");
  await db.run("PRAGMA foreign_keys = ON");
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  await db.insert(users).values({ id: LOCAL_USER_ID, name: "Local agent" }).onConflictDoNothing();
}
