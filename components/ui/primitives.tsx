import { Fragment, type ReactNode } from "react";
import { fenToYuan } from "@/lib/money";
import { BRAND, payLabel, statusLabel, type ProviderKey } from "@/lib/ui";
import { Icon, type IconName } from "./Icon";

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Icon name="bridge" />
      </span>
      {BRAND}
    </div>
  );
}

export function ChannelIcon({ provider, size }: { provider: ProviderKey | string; size?: "tiny" | "lg" }) {
  const ali = provider === "alipay";
  return (
    <span className={["channel-icon", ali && "ali", size].filter(Boolean).join(" ")}>
      <Icon name={ali ? "ali" : "wx"} />
    </span>
  );
}

/** Channel icon + "微信支付" / "支付宝". */
export function Channel({ provider }: { provider: ProviderKey | string }) {
  return (
    <span className="channel">
      <ChannelIcon provider={provider} size="tiny" />
      {payLabel(provider)}
    </span>
  );
}

export function StatusBadge({ status, children }: { status: string; children?: ReactNode }) {
  return (
    <span className={`badge ${status}`} data-status={status} title={status}>
      {children ?? statusLabel(status)}
    </span>
  );
}

export function Money({ fen, className, unit }: { fen: number; className?: string; unit?: string }) {
  return (
    <div className={["money", className].filter(Boolean).join(" ")}>
      <span className="currency">¥</span>
      {fenToYuan(fen)}
      {unit && <small>{unit}</small>}
    </div>
  );
}

const STEPS = ["确认订单", "完成支付", "查看结果"];

export function Steps({ current }: { current: 0 | 1 | 2 }) {
  return (
    <div className="steps" role="list" aria-label="支付进度">
      {STEPS.map((label, i) => (
        <Fragment key={label}>
          {i > 0 && <span className={`step-line ${i <= current ? "done" : ""}`} aria-hidden="true" />}
          <div role="listitem" className={`step ${i === current ? "active" : i < current ? "done" : ""}`} aria-current={i === current ? "step" : undefined}>
            <b>{i < current ? <Icon name="check" small /> : i + 1}</b>
            {label}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

export function PageHeading({ title, desc, extra }: { title: ReactNode; desc?: ReactNode; extra?: ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {desc && <p>{desc}</p>}
      </div>
      {extra}
    </div>
  );
}

export function Avatar({ name, src, size }: { name: string; src?: string | null; size?: "sm" | "lg" }) {
  const cls = ["avatar", size].filter(Boolean).join(" ");
  if (src) {
    // Provider avatars come from arbitrary CDNs (or data: URIs in mock mode); next/image would need an allow-list.
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={cls} src={src} alt="" referrerPolicy="no-referrer" />;
  }
  return (
    <span className={cls} aria-hidden="true">
      {name.trim().slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}

export function Hint({ tone, icon = "info", children, className }: { tone?: "blue" | "amber" | "green" | "red"; icon?: IconName; children: ReactNode; className?: string }) {
  return (
    <div className={["hint", tone, className].filter(Boolean).join(" ")}>
      <Icon name={icon} />
      <div>{children}</div>
    </div>
  );
}

/** Small dl of order facts shared by the order page and the mock cashier. */
export function DetailList({ items }: { items: [ReactNode, ReactNode, string?][] }) {
  return (
    <dl className="details">
      {items.map(([k, v, cls], i) => (
        <div key={i} className="details-row">
          <dt>{k}</dt>
          <dd className={cls}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
