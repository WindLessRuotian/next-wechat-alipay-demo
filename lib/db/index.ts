import "server-only";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema";
import { env } from "@/lib/env";

/**
 * SQLite via libSQL. The driver ships prebuilt binaries per platform as npm
 * optional dependencies, so `npm install` never needs a C/C++ toolchain.
 */
export type DB = LibSQLDatabase<typeof schema>;

const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

/** Open a SQLite file and bring it to the latest migration. */
export async function openDatabase(file: string): Promise<DB> {
  const url = pathToFileURL(path.resolve(/*turbopackIgnore: true*/ process.cwd(), file)).toString();
  const client = createClient({ url });
  await client.execute("PRAGMA journal_mode = WAL");
  await client.execute("PRAGMA busy_timeout = 5000");
  await client.execute("PRAGMA foreign_keys = ON");
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return db;
}

const globalForDb = globalThis as unknown as { __db?: Promise<DB> };

/** Process-wide singleton (survives Next.js dev hot reloads); resolves once migrations ran. */
export function db(): Promise<DB> {
  globalForDb.__db ??= openDatabase(env().DATABASE_URL.replace(/^file:/, "")).catch((e: unknown) => {
    globalForDb.__db = undefined;
    throw e;
  });
  return globalForDb.__db;
}

/**
 * libSQL runs each interactive transaction on its own connection, and SQLite
 * allows one writer at a time: two overlapping transactions would fail with
 * SQLITE_BUSY. This app is a single Node process, so an in-process FIFO lock
 * serialises write transactions. (A multi-instance deployment would move to
 * Postgres, where the same UPDATE … WHERE status='pending' pattern is safe.)
 */
const globalForLock = globalThis as unknown as { __dbWriteLock?: Promise<unknown> };

export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

export async function withWriteTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const d = await db();
  const prev = globalForLock.__dbWriteLock ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(() => d.transaction(fn, { behavior: "immediate" }));
  globalForLock.__dbWriteLock = run.catch(() => undefined);
  return run;
}

export { schema };
