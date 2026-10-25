import "server-only";
import { log } from "@/lib/log";
import { sweepPendingOrders } from "./sync";

/** How often unpaid orders are checked for expiry and reconciled with the provider. */
export const SWEEP_INTERVAL_MS = 30_000;

const state = globalThis as unknown as { __orderSweeper?: ReturnType<typeof setInterval> };

/**
 * Background job for the single Node.js server process (started from instrumentation):
 * orders expire and missed notifications are recovered even if nobody opens the order.
 * Idempotent across dev hot reloads; the timer never keeps the process alive on its own.
 */
export function startOrderSweeper(intervalMs = SWEEP_INTERVAL_MS): void {
  if (state.__orderSweeper) return;
  let running = false;
  const tick = async () => {
    if (running) return; // a slow provider must not stack passes
    running = true;
    try {
      await sweepPendingOrders();
    } catch (e) {
      log.warn("order.sweep_failed", { message: e instanceof Error ? e.message : String(e) });
    } finally {
      running = false;
    }
  };
  state.__orderSweeper = setInterval(tick, intervalMs);
  state.__orderSweeper.unref();
  log.info("order.sweeper_started", { intervalMs });
}
