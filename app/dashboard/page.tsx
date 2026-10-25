import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { accountsForUser } from "@/lib/auth/users";
import { TEST_ITEM } from "@/lib/catalog";
import { ERROR_MESSAGES, formatCny, providerLabel } from "@/lib/ui";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ error?: string; linked?: string }> }) {
  const { user, provider } = await requireSession();
  const { error, linked } = await searchParams;
  const accounts = await accountsForUser(user.id);
  const missing = (["wechat", "alipay"] as const).filter((p) => !accounts.some((a) => a.provider === p));

  return (
    <>
      <h1>Dashboard</h1>
      {error && <p className="alert error">{ERROR_MESSAGES[error] ?? "Something went wrong."}</p>}
      {linked && <p className="alert ok">Account linked.</p>}
      <section className="card">
        <div className="row">
          {user.avatarUrl ? (
            // Provider avatars come from arbitrary CDNs; next/image would need a domain allow-list.
            // eslint-disable-next-line @next/next/no-img-element
            <img className="avatar" src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
            <div className="avatar" />
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{user.name}</div>
            <div className="muted">Signed in with {providerLabel(provider)}</div>
          </div>
        </div>
        <dl className="kv" style={{ marginTop: 16 }}>
          {accounts.map((a) => (
            <div key={a.id} style={{ display: "contents" }}>
              <dt>{providerLabel(a.provider)}</dt>
              <dd className="mono">
                {a.nickname ?? "—"} · id {a.providerUserId}
                {a.unionId ? ` · unionid ${a.unionId}` : ""}
              </dd>
            </div>
          ))}
        </dl>
        {missing.length > 0 && (
          <p className="muted" style={{ marginBottom: 0 }}>
            Link another account:{" "}
            {missing.map((p) => (
              <a key={p} href={`/api/auth/${p}/login?link=1`} style={{ marginRight: 12 }}>
                + {providerLabel(p)}
              </a>
            ))}
          </p>
        )}
      </section>

      <section className="card">
        <h2>Buy test item</h2>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div>{TEST_ITEM.subject}</div>
            <div className="muted">{formatCny(TEST_ITEM.amountFen)} · price fixed on the server</div>
          </div>
          <Link className="btn primary" href="/checkout">
            Buy for {formatCny(TEST_ITEM.amountFen)}
          </Link>
        </div>
      </section>
    </>
  );
}
