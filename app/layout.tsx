import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "WeChat & Alipay Integration Demo",
  description: "Next.js trial task: WeChat / Alipay login and payment",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const e = env();
  const session = await getSession();
  const mocked = [e.wechatMode === "mock" && "WeChat", e.alipayMode === "mock" && "Alipay"].filter(Boolean);
  return (
    <html lang="zh-CN">
      <body>
        {mocked.length > 0 && (
          <div className="mock-banner" role="status">
            MOCK MODE — {mocked.join(" & ")} simulated locally · WeChat: {e.wechatMode} · Alipay: {e.alipayMode}
          </div>
        )}
        <header className="top">
          <Link className="brand" href="/">
            Pay Demo
          </Link>
          {session && (
            <nav>
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/orders">Orders</Link>
              <form action="/api/auth/logout" method="post">
                <button className="linkbtn" type="submit">
                  Log out
                </button>
              </form>
            </nav>
          )}
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
