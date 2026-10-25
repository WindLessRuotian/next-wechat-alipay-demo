// Validate configuration at boot so a missing variable fails loudly, not on the first payment.
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { EnvError, env } from "./lib/env";
import { startOrderSweeper } from "./lib/payments/sweeper";

try {
  const e = env();
  console.info(`[config] OK — WeChat: ${e.wechatMode}, Alipay: ${e.alipayMode}, APP_URL=${e.APP_URL}`);
} catch (err) {
  if (err instanceof EnvError) {
    console.error(`\n${err.message}\n`);
    process.exit(1);
  }
  throw err;
}

// Expire unpaid orders and recover missed notifications without waiting for a page view.
if (process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD) startOrderSweeper();
