import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BRAND } from "@/lib/ui";

export const metadata: Metadata = {
  title: { default: `${BRAND} · 微信与支付宝登录支付演示`, template: `%s · ${BRAND}` },
  description: "Next.js 微信 / 支付宝登录与支付集成演示：服务端下单、异步通知验签、幂等处理与 Mock 模式。",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#2563eb" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Browsers and extensions add attributes to <html>/<body> before React hydrates (e.g. iOS Edge/Chrome's
    // __gcrremoteframetoken, Immersive Translate's data-immersive-translate-page-theme). This silences
    // attribute mismatches on these two elements only; their children are still checked.
    <html lang="zh-CN" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
