/**
 * Runs once when the Next.js server starts. Node-only work lives in a separate
 * module (per the Next.js instrumentation docs) so the Edge bundle stays clean.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
