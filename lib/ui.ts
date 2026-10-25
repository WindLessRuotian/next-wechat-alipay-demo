import { TEST_ITEM } from "./catalog";
import { fenToYuan } from "./money";
import { toBeijingDateTime } from "./time";

export const BRAND = "MockPAY";

export type ProviderKey = "wechat" | "alipay";
export type StatusKey = "pending" | "paid" | "failed" | "closed";
export type ModeKey = "mock" | "sandbox" | "live";

export const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "授权已失效或校验未通过（OAuth state 不匹配），本次未建立登录会话，请重新登录。",
  access_denied: "已取消授权，可以重新选择登录方式。",
  exchange_failed: "未能向渠道换取授权信息，请稍后重新登录。",
  invalid_app: "回调来自未登记的应用（app_id 不匹配），已拒绝。",
  signin_required: "请先登录后再访问该页面。",
  linked_to_other_user: "这个身份已关联其他账号。为保护订单归属，不能自动合并账号，请使用其他身份关联。",
  provider_already_linked: "当前账号已关联该渠道的身份，无需重复关联。",
};

/** Login identity: 微信 / 支付宝. */
export const providerLabel = (p: string) => (p === "wechat" ? "微信" : p === "alipay" ? "支付宝" : p);
/** Payment channel: 微信支付 / 支付宝. */
export const payLabel = (p: string) => (p === "wechat" ? "微信支付" : p === "alipay" ? "支付宝" : p);

export const STATUS_LABELS: Record<StatusKey, string> = { pending: "待支付", paid: "已支付", failed: "支付失败", closed: "已关闭" };
export const statusLabel = (s: string) => STATUS_LABELS[s as StatusKey] ?? s;

export const MODE_LABELS: Record<ModeKey, string> = { mock: "Mock", sandbox: "沙箱", live: "正式" };

export const formatCny = (fen: number) => `¥${fenToYuan(fen)}`;
/** "2026-10-25 14:32:08", always Beijing time so server and browser render the same text. */
export const formatTime = (d: Date | string) => toBeijingDateTime(typeof d === "string" ? new Date(d) : d);

/** Display name for the catalog item; the provider-facing subject stays as stored. */
export const ITEM_NAME = "支付体验商品";
export const itemName = (subject: string) => (subject === TEST_ITEM.subject ? ITEM_NAME : subject);

const FAILURE_REASONS: Record<string, string> = {
  cancelled_by_user: "用户主动取消",
  expired: "超过有效期未支付，已自动关闭",
  "provider reported failure": "渠道返回支付失败",
  PAYERROR: "渠道返回支付失败（PAYERROR）",
};
export const failureLabel = (reason: string) => FAILURE_REASONS[reason] ?? reason;
