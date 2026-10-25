import { Icon } from "@/components/ui/Icon";
import { MODE_LABELS, type ModeKey } from "@/lib/ui";

/**
 * Per-provider environment strip. Mixed setups (e.g. Alipay sandbox + WeChat mock)
 * are labelled per channel so one channel's real capability is never implied for the other.
 */
export function EnvironmentBanner({ wechat, alipay }: { wechat: ModeKey; alipay: ModeKey }) {
  const anyMock = wechat === "mock" || alipay === "mock";
  const anyLive = wechat === "live" || alipay === "live";
  const tone = anyMock ? "mock" : anyLive ? "live" : "sandbox";
  const mocked = [wechat === "mock" && "微信", alipay === "mock" && "支付宝"].filter(Boolean).join("、");

  return (
    <div className={`envstrip ${tone}`} role="status">
      <Icon name="info" />
      {tone === "mock" && (
        <>
          <strong>MOCK MODE · 模拟环境</strong>
          <span>{wechat === "mock" && alipay === "mock" ? "当前流程仅供体验，不会产生真实扣款。" : `${mocked}为本地模拟，不会产生真实扣款。`}</span>
        </>
      )}
      {tone === "sandbox" && (
        <>
          <strong>SANDBOX · 沙箱环境</strong>
          <span>请使用沙箱买家账号付款，不会产生真实扣款。</span>
        </>
      )}
      {tone === "live" && (
        <>
          <strong>LIVE · 正式环境</strong>
          <span>付款将从真实账户扣款（测试商品 0.01 元）。</span>
        </>
      )}
      <div className="right">
        <span>微信：{MODE_LABELS[wechat]}</span>
        <span>支付宝：{MODE_LABELS[alipay]}</span>
      </div>
    </div>
  );
}
