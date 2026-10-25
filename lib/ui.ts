import { fenToYuan } from "./money";

export const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "Login rejected: the OAuth state did not match (possible CSRF, or the link expired). Please try again.",
  access_denied: "Login was cancelled.",
  exchange_failed: "Could not exchange the authorization code with the provider.",
  invalid_app: "Callback came from an unexpected app_id.",
  signin_required: "Please sign in first.",
  linked_to_other_user: "That account is already linked to a different user.",
  provider_already_linked: "You already have an account of that provider linked.",
};

export const providerLabel = (p: string) => (p === "wechat" ? "WeChat" : p === "alipay" ? "Alipay" : p);
export const formatCny = (fen: number) => `¥${fenToYuan(fen)}`;
