import { AppShell, GuestShell } from "@/components/shell/AppShell";
import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { listOrdersForUser } from "@/lib/payments/orders";

/** Everything except the landing page: the signed-in workspace, or a bare shell for the mock consent screen. */
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const e = env();
  const modes = { wechat: e.wechatMode, alipay: e.alipayMode };
  const session = await getSession();
  if (!session) return <GuestShell modes={modes}>{children}</GuestShell>;

  const orderCount = (await listOrdersForUser(session.user.id)).length;
  return (
    <AppShell modes={modes} user={session.user} provider={session.provider} orderCount={orderCount}>
      {children}
    </AppShell>
  );
}
