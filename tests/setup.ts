import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

// Deterministic, offline test environment: mock providers + a throw-away SQLite file per worker.
// (A file rather than :memory:, because libSQL opens a separate connection for transactions.)
Object.assign(process.env, {
  NODE_ENV: "test",
  APP_URL: "http://localhost:3000",
  SESSION_SECRET: "test-secret-test-secret-test-secret-0123",
  DATABASE_URL: `file:${path.join(os.tmpdir(), `pay-demo-test-${process.pid}-${crypto.randomBytes(4).toString("hex")}.db`)}`,
  PAYMENT_MODE: "mock",
});
