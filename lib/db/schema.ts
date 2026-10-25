import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const PROVIDERS = ["wechat", "alipay"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const ORDER_STATUSES = ["pending", "paid", "failed", "closed"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const now = sql`(unixepoch() * 1000)`;
const ts = (name: string) => integer(name, { mode: "timestamp_ms" });

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: ts("created_at").notNull().default(now),
});

/** One row per external identity; (provider, provider_user_id) is the natural key. */
export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: PROVIDERS }).notNull(),
    providerUserId: text("provider_user_id").notNull(),
    unionId: text("union_id"),
    nickname: text("nickname"),
    avatarUrl: text("avatar_url"),
    createdAt: ts("created_at").notNull().default(now),
    updatedAt: ts("updated_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("accounts_provider_uid").on(t.provider, t.providerUserId),
    // one account per provider per user (needed for safe account linking)
    uniqueIndex("accounts_user_provider").on(t.userId, t.provider),
  ],
);

/** Server-side sessions. Only an HMAC of the cookie token is stored. */
export const sessions = sqliteTable(
  "sessions",
  {
    idHash: text("id_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: PROVIDERS }).notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: ts("created_at").notNull().default(now),
  },
  (t) => [index("sessions_user").on(t.userId)],
);

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    /** Merchant order number sent to the provider (6–32 chars, [A-Za-z0-9]). */
    outTradeNo: text("out_trade_no").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: PROVIDERS }).notNull(),
    subject: text("subject").notNull(),
    /** Integer minor units (fen). Never floats for money. */
    amountFen: integer("amount_fen").notNull(),
    currency: text("currency").notNull().default("CNY"),
    status: text("status", { enum: ORDER_STATUSES }).notNull().default("pending"),
    providerTradeNo: text("provider_trade_no"),
    codeUrl: text("code_url"),
    failureReason: text("failure_reason"),
    expiresAt: ts("expires_at").notNull(),
    paidAt: ts("paid_at"),
    closedAt: ts("closed_at"),
    lastQueriedAt: ts("last_queried_at"),
    createdAt: ts("created_at").notNull().default(now),
    updatedAt: ts("updated_at").notNull().default(now),
  },
  (t) => [index("orders_user_created").on(t.userId, t.createdAt)],
);

/**
 * Every verified provider event (notification or query result) that we acted on.
 * The unique (provider, event_id) index is the idempotency key.
 */
export const paymentEvents = sqliteTable(
  "payment_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    provider: text("provider", { enum: PROVIDERS }).notNull(),
    eventId: text("event_id").notNull(),
    source: text("source", { enum: ["notify", "query"] }).notNull(),
    outTradeNo: text("out_trade_no").notNull(),
    eventType: text("event_type").notNull(),
    /** Outcome of applying the event: applied | duplicate | ignored | rejected */
    outcome: text("outcome").notNull(),
    detail: text("detail"),
    createdAt: ts("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("payment_events_provider_event").on(t.provider, t.eventId)],
);

/* ------------------------------------------------------------------ */
/* Mock-mode only: a tiny stand-in for the provider's own state.       */
/* ------------------------------------------------------------------ */

export const mockOauthCodes = sqliteTable("mock_oauth_codes", {
  code: text("code").primaryKey(),
  provider: text("provider", { enum: PROVIDERS }).notNull(),
  profileJson: text("profile_json").notNull(),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
});

export const mockTrades = sqliteTable("mock_trades", {
  outTradeNo: text("out_trade_no").primaryKey(),
  provider: text("provider", { enum: PROVIDERS }).notNull(),
  amountFen: integer("amount_fen").notNull(),
  /** Provider-native state, e.g. NOTPAY/SUCCESS/PAYERROR/CLOSED or WAIT_BUYER_PAY/TRADE_SUCCESS/TRADE_CLOSED. */
  state: text("state").notNull(),
  tradeNo: text("trade_no").notNull(),
  updatedAt: ts("updated_at").notNull().default(now),
});

export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Order = typeof orders.$inferSelect;
