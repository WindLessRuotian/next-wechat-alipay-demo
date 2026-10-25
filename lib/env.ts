import { z } from "zod";

/**
 * Environment validation.
 *
 * - `PAYMENT_MODE` is the global default (mock | sandbox | live).
 * - `WECHAT_MODE` / `ALIPAY_MODE` optionally override it per provider, so that
 *   e.g. Alipay can run against the real sandbox while WeChat stays mocked
 *   (WeChat has no public sandbox and needs company-verified accounts).
 * - Credentials are only required for providers that are NOT in mock mode.
 *
 * Validation runs once, on first access (see instrumentation.ts, which forces
 * it at server start-up), and fails with a list of every problem at once.
 */

const mode = z.enum(["mock", "sandbox", "live"]);
export type Mode = z.infer<typeof mode>;

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === "" ? undefined : v.trim()));

const baseSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url({ message: "APP_URL must be an absolute URL, e.g. http://localhost:3000" }),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  DATABASE_URL: z.string().startsWith("file:", "DATABASE_URL must be a SQLite file: URL"),
  PAYMENT_MODE: mode.default("mock"),
  WECHAT_MODE: mode.optional().or(z.literal("").transform(() => undefined)),
  ALIPAY_MODE: mode.optional().or(z.literal("").transform(() => undefined)),
  ORDER_TTL_MINUTES: z.coerce.number().int().min(1).max(120).default(15),

  WECHAT_APP_ID: optionalString,
  WECHAT_APP_SECRET: optionalString,

  WECHAT_PAY_MCH_ID: optionalString,
  WECHAT_PAY_APP_ID: optionalString,
  WECHAT_PAY_API_V3_KEY: optionalString,
  WECHAT_PAY_CERT_SERIAL_NO: optionalString,
  WECHAT_PAY_PRIVATE_KEY_PATH: optionalString,
  WECHAT_PAY_PLATFORM_PUBLIC_KEY_PATH: optionalString,
  WECHAT_PAY_PLATFORM_PUBLIC_KEY_ID: optionalString,
  WECHAT_PAY_NOTIFY_URL: optionalString,

  ALIPAY_APP_ID: optionalString,
  ALIPAY_PRIVATE_KEY: optionalString,
  ALIPAY_PUBLIC_KEY: optionalString,
  ALIPAY_SELLER_ID: optionalString,
  ALIPAY_GATEWAY: optionalString,
  ALIPAY_AUTH_URL: optionalString,
  ALIPAY_NOTIFY_URL: optionalString,
  ALIPAY_RETURN_URL: optionalString,
});

type Base = z.infer<typeof baseSchema>;

export type Env = Base & { wechatMode: Mode; alipayMode: Mode };

const WECHAT_REQUIRED = [
  "WECHAT_APP_ID",
  "WECHAT_APP_SECRET",
  "WECHAT_PAY_MCH_ID",
  "WECHAT_PAY_APP_ID",
  "WECHAT_PAY_API_V3_KEY",
  "WECHAT_PAY_CERT_SERIAL_NO",
  "WECHAT_PAY_PRIVATE_KEY_PATH",
  "WECHAT_PAY_PLATFORM_PUBLIC_KEY_PATH",
  "WECHAT_PAY_PLATFORM_PUBLIC_KEY_ID",
  "WECHAT_PAY_NOTIFY_URL",
] as const satisfies readonly (keyof Base)[];

const ALIPAY_REQUIRED = [
  "ALIPAY_APP_ID",
  "ALIPAY_PRIVATE_KEY",
  "ALIPAY_PUBLIC_KEY",
  "ALIPAY_GATEWAY",
  "ALIPAY_AUTH_URL",
  "ALIPAY_NOTIFY_URL",
  "ALIPAY_RETURN_URL",
] as const satisfies readonly (keyof Base)[];

export function parseEnv(source: Record<string, string | undefined>): Env {
  const parsed = baseSchema.safeParse(source);
  if (!parsed.success) {
    throw new EnvError(parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`));
  }
  const base = parsed.data;
  const wechatMode = base.WECHAT_MODE ?? base.PAYMENT_MODE;
  const alipayMode = base.ALIPAY_MODE ?? base.PAYMENT_MODE;
  const problems: string[] = [];

  if (wechatMode !== "mock") {
    for (const k of WECHAT_REQUIRED) if (!base[k]) problems.push(`${k}: required when WeChat mode is "${wechatMode}"`);
    if (base.WECHAT_PAY_API_V3_KEY && Buffer.byteLength(base.WECHAT_PAY_API_V3_KEY) !== 32) {
      problems.push("WECHAT_PAY_API_V3_KEY: must be exactly 32 bytes (AES-256 key)");
    }
  }
  if (alipayMode !== "mock") {
    for (const k of ALIPAY_REQUIRED) if (!base[k]) problems.push(`${k}: required when Alipay mode is "${alipayMode}"`);
  }
  if (problems.length) throw new EnvError(problems);

  return { ...base, wechatMode, alipayMode };
}

export class EnvError extends Error {
  constructor(public readonly problems: string[]) {
    super(
      `Invalid environment configuration:\n  - ${problems.join("\n  - ")}\n` +
        `Copy .env.example to .env.local and fill in the values (see README).`,
    );
    this.name = "EnvError";
  }
}

let cached: Env | undefined;

export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** Test helper: reset the memoised env after mutating process.env. */
export function __resetEnvForTests(): void {
  cached = undefined;
}

export const isSecureCookie = (): boolean => env().APP_URL.startsWith("https://");
