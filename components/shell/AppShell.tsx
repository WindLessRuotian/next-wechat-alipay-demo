import type { ReactNode } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { InfoDialogButton, LogoutButton } from "@/components/ui/Modal";
import { Avatar, Brand } from "@/components/ui/primitives";
import { BRAND, providerLabel, type ModeKey } from "@/lib/ui";
import { EnvironmentBanner } from "./EnvironmentBanner";
import { Breadcrumb, MobileNav, SidebarNav } from "./Nav";

interface ShellProps {
  modes: { wechat: ModeKey; alipay: ModeKey };
  children: ReactNode;
}

function AboutText({ modes }: Pick<ShellProps, "modes">) {
  const mock = modes.wechat === "mock" || modes.alipay === "mock";
  return (
    <>
      <p>
        {BRAND} 是一个 Next.js 微信 / 支付宝登录与支付集成演示：服务端创建订单，渠道异步通知验签后才会把订单标记为已支付，浏览器跳转不会改变支付状态。
      </p>
      {mock && <p>Mock 模式只替换渠道一侧：模拟付款会生成正确签名的通知，发送到与真实环境相同的通知接口，因此验签、解密、金额核对与幂等逻辑都会真实执行，但不会产生扣款。</p>}
    </>
  );
}

function Footer() {
  return (
    <div className="bottom-note">
      <span>{BRAND} · 登录与支付集成体验</span>
      <span>
        <Icon name="lock" small /> 签名、验签与支付状态均在服务端确认
      </span>
    </div>
  );
}

/** Signed-in workspace: sidebar, top bar, environment strip and the mobile bottom nav. */
export function AppShell({
  modes,
  user,
  provider,
  orderCount,
  children,
}: ShellProps & { user: { name: string; avatarUrl: string | null }; provider: string; orderCount: number }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand-link" aria-label={`${BRAND} 控制台`}>
          <Brand />
        </Link>
        <div className="workspace-switch">
          <span className="workspace-icon">
            <Icon name="building" />
          </span>
          <div className="flex1">
            <strong>个人体验工作台</strong>
            <div className="workspace-sub">Personal workspace</div>
          </div>
        </div>
        <SidebarNav orderCount={orderCount} />
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <div className="row" style={{ gap: 7 }}>
              <Icon name="code" small />
              集成演示项目
            </div>
            <p>同一套流程，连接两大支付渠道。</p>
            <InfoDialogButton label="了解演示边界" triggerIcon="external" title="关于这个演示">
              <AboutText modes={modes} />
            </InfoDialogButton>
          </div>
          <div className="sidebar-user">
            <Avatar name={user.name} src={user.avatarUrl} />
            <div className="flex1">
              <strong className="ellipsis">{user.name}</strong>
              <div className="sidebar-user-sub">{providerLabel(provider)}登录</div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </aside>
      <div className="shell-right">
        <header className="topbar">
          <Breadcrumb />
          <Link href="/dashboard" className="mobile-brand brand-link" aria-label={`${BRAND} 控制台`}>
            <Brand />
          </Link>
          <div className="topbar-right">
            <span className="tag">开发体验版</span>
            <InfoDialogButton className="icon-btn" ariaLabel="帮助与说明" triggerIcon="help" title="关于这个演示">
              <AboutText modes={modes} />
            </InfoDialogButton>
            <span className="topbar-divider" aria-hidden="true" />
            <Avatar name={user.name} src={user.avatarUrl} size="sm" />
            <span className="quiet topbar-name ellipsis">{user.name}</span>
            {/* The sidebar (and its logout) is hidden under 760px. */}
            <span className="mobile-logout">
              <LogoutButton />
            </span>
          </div>
        </header>
        <EnvironmentBanner wechat={modes.wechat} alipay={modes.alipay} />
        <main className="main">
          {children}
          <Footer />
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

/** Signed-out pages inside the workspace group (the mock consent screen): no navigation. */
export function GuestShell({ modes, children }: ShellProps) {
  return (
    <div className="guest-shell">
      <header className="topbar">
        <Link href="/" className="brand-link" aria-label={`${BRAND} 登录`}>
          <Brand />
        </Link>
        <div className="topbar-right">
          <span className="tag">开发体验版</span>
        </div>
      </header>
      <EnvironmentBanner wechat={modes.wechat} alipay={modes.alipay} />
      <main className="main">
        {children}
        <Footer />
      </main>
    </div>
  );
}
