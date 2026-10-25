/* Apply migrations explicitly (the app also does this lazily on first DB access). */
import path from "node:path";
import { pathToFileURL } from "node:url";
import nextEnv from "@next/env";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

nextEnv.loadEnvConfig(process.cwd());
const file = (process.env.DATABASE_URL ?? "file:./dev.db").replace(/^file:/, "");
const client = createClient({ url: pathToFileURL(path.resolve(process.cwd(), file)).toString() });
await migrate(drizzle(client), { migrationsFolder: path.join(process.cwd(), "drizzle") });
console.log(`Migrations applied to ${file}`);
client.close();
