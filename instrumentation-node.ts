// Validate configuration at boot so a missing variable fails loudly, not on the first payment.
import { EnvError, env } from "./lib/env";

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
