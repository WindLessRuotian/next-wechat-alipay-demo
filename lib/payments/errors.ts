export class ProviderError extends Error {
  constructor(
    public readonly provider: "wechat" | "alipay",
    public readonly code: string,
    message: string,
    public readonly httpStatus?: number,
  ) {
    super(`[${provider}] ${code}: ${message}`);
    this.name = "ProviderError";
  }
}
