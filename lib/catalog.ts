/**
 * The only thing for sale. Price lives on the server; the browser never sends an amount.
 */
export const TEST_ITEM = {
  sku: "test-item-001",
  subject: "Test item (integration demo)",
  amountFen: 1, // 0.01 CNY
  currency: "CNY",
} as const;
