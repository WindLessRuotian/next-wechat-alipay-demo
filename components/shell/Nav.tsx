"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";

type Section = "dashboard" | "checkout" | "orders";

const ITEMS: { key: Section; href: string; label: string; short: string; icon: IconName }[] = [
  { key: "dashboard", href: "/dashboard", label: "控制台", short: "控制台", icon: "grid" },
  { key: "checkout", href: "/checkout", label: "购买商品", short: "购买", icon: "bag" },
  { key: "orders", href: "/orders", label: "我的订单", short: "订单", icon: "file" },
];

function section(pathname: string): Section | null {
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/checkout")) return "checkout";
  if (pathname.startsWith("/orders") || pathname.startsWith("/mock/alipay")) return "orders";
  return null;
}

function pageTitle(pathname: string): string {
  if (pathname.startsWith("/dashboard")) return "控制台";
  if (pathname.startsWith("/checkout")) return "购买商品";
  if (/^\/orders\/[^/]+/.test(pathname)) return "订单详情";
  if (pathname.startsWith("/orders")) return "我的订单";
  if (pathname.startsWith("/mock/oauth")) return "账号授权";
  if (pathname.startsWith("/mock/alipay")) return "模拟收银台";
  return "工作空间";
}

export function SidebarNav({ orderCount }: { orderCount: number }) {
  const active = section(usePathname());
  return (
    <nav aria-label="主导航">
      <div className="nav-label">工作空间</div>
      {ITEMS.map((it) => (
        <Link key={it.key} href={it.href} className={`nav-item ${active === it.key ? "active" : ""}`} aria-current={active === it.key ? "page" : undefined}>
          <Icon name={it.icon} />
          {it.label}
          {it.key === "orders" && orderCount > 0 && <span className="count">{orderCount}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function MobileNav() {
  const active = section(usePathname());
  return (
    <nav className="mobile-nav" aria-label="移动端导航">
      {ITEMS.map((it) => (
        <Link key={it.key} href={it.href} className={active === it.key ? "active" : undefined} aria-current={active === it.key ? "page" : undefined}>
          <Icon name={it.icon} />
          {it.short}
        </Link>
      ))}
    </nav>
  );
}

export function Breadcrumb() {
  return (
    <div className="breadcrumb">
      <span>工作空间</span>
      <span aria-hidden="true">/</span>
      <strong>{pageTitle(usePathname())}</strong>
    </div>
  );
}
