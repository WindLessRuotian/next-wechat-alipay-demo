import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Brand } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="notfound">
      <section className="card">
        <div className="row center" style={{ marginBottom: 26 }}>
          <Brand />
        </div>
        <div className="result-icon gray">
          <Icon name="search" />
        </div>
        <h2>页面或订单不存在</h2>
        <p className="caption" style={{ marginTop: 8 }}>
          链接可能已失效，或这笔订单不属于当前登录账号。
        </p>
        <div className="actions">
          <Link className="btn" href="/orders">
            我的订单
          </Link>
          <Link className="btn primary" href="/dashboard">
            返回控制台
          </Link>
        </div>
      </section>
    </div>
  );
}
