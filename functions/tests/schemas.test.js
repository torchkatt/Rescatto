const assert = require("assert");
const {
  CreateNotificationSchema,
  GenerateWompiSignatureSchema,
  CreateOrderSchema,
  WompiWebhookSchema,
  ResolveVenueChatTargetSchema,
  RedeemPointsSchema,
  SendVerificationEmailSchema,
  DeleteUserAccountSchema,
  GetFinanceStatsSchema,
} = require("../schemas");

// Simple test runner
let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

console.log("\n--- CreateNotificationSchema ---");
test("accepts valid notification", () => {
  const result = CreateNotificationSchema.safeParse({ userId: "u1", title: "Hello", message: "World" });
  assert.strictEqual(result.success, true);
});
test("rejects missing userId", () => {
  const result = CreateNotificationSchema.safeParse({ title: "Hello", message: "World" });
  assert.strictEqual(result.success, false);
});
test("rejects title > 120 chars", () => {
  const result = CreateNotificationSchema.safeParse({ userId: "u1", title: "x".repeat(121), message: "ok" });
  assert.strictEqual(result.success, false);
});
test("defaults type to info", () => {
  const result = CreateNotificationSchema.safeParse({ userId: "u1", title: "Hello", message: "World" });
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.data.type, "info");
});

console.log("\n--- GenerateWompiSignatureSchema ---");
test("accepts valid signature request", () => {
  const result = GenerateWompiSignatureSchema.safeParse({ reference: "ref1", amount: 10000 });
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.data.currency, "COP");
});
test("rejects negative amount", () => {
  const result = GenerateWompiSignatureSchema.safeParse({ reference: "ref1", amount: -100 });
  assert.strictEqual(result.success, false);
});
test("rejects missing reference", () => {
  const result = GenerateWompiSignatureSchema.safeParse({ amount: 10000 });
  assert.strictEqual(result.success, false);
});

console.log("\n--- CreateOrderSchema ---");
test("accepts valid order", () => {
  const result = CreateOrderSchema.safeParse({
    venueId: "v1",
    products: [{ productId: "p1", quantity: 2 }],
    paymentMethod: "cash",
    deliveryMethod: "pickup",
  });
  assert.strictEqual(result.success, true);
});
test("rejects empty products array", () => {
  const result = CreateOrderSchema.safeParse({
    venueId: "v1",
    products: [],
    paymentMethod: "cash",
    deliveryMethod: "pickup",
  });
  assert.strictEqual(result.success, false);
});
test("rejects invalid payment method", () => {
  const result = CreateOrderSchema.safeParse({
    venueId: "v1",
    products: [{ productId: "p1", quantity: 1 }],
    paymentMethod: "bitcoin",
    deliveryMethod: "pickup",
  });
  assert.strictEqual(result.success, false);
});
test("clamps deliveryFee to max 25000", () => {
  const result = CreateOrderSchema.safeParse({
    venueId: "v1",
    products: [{ productId: "p1", quantity: 1 }],
    paymentMethod: "cash",
    deliveryMethod: "delivery",
    address: "Calle 1",
    deliveryFee: 30000,
  });
  assert.strictEqual(result.success, false);
});

console.log("\n--- WompiWebhookSchema ---");
test("accepts valid webhook", () => {
  const result = WompiWebhookSchema.safeParse({
    event: "transaction.updated",
    data: { transaction: { id: "tx1", status: "APPROVED" } },
  });
  assert.strictEqual(result.success, true);
});
test("rejects missing transaction", () => {
  const result = WompiWebhookSchema.safeParse({ event: "transaction.updated", data: {} });
  assert.strictEqual(result.success, false);
});

console.log("\n--- ResolveVenueChatTargetSchema ---");
test("accepts valid orderId", () => {
  const result = ResolveVenueChatTargetSchema.safeParse({ orderId: "order123" });
  assert.strictEqual(result.success, true);
});
test("rejects empty orderId", () => {
  const result = ResolveVenueChatTargetSchema.safeParse({ orderId: "" });
  assert.strictEqual(result.success, false);
});

console.log("\n--- RedeemPointsSchema ---");
test("accepts valid redemption", () => {
  const result = RedeemPointsSchema.safeParse({ rewardId: "discount_5k", pointsCost: 50 });
  assert.strictEqual(result.success, true);
});
test("rejects zero pointsCost", () => {
  const result = RedeemPointsSchema.safeParse({ rewardId: "discount_5k", pointsCost: 0 });
  assert.strictEqual(result.success, false);
});

console.log("\n--- SendVerificationEmailSchema ---");
test("accepts valid email", () => {
  const result = SendVerificationEmailSchema.safeParse({ email: "test@example.com" });
  assert.strictEqual(result.success, true);
});
test("rejects invalid email", () => {
  const result = SendVerificationEmailSchema.safeParse({ email: "not-an-email" });
  assert.strictEqual(result.success, false);
});

console.log("\n--- DeleteUserAccountSchema ---");
test("accepts valid uid", () => {
  const result = DeleteUserAccountSchema.safeParse({ uid: "user123" });
  assert.strictEqual(result.success, true);
});
test("rejects empty uid", () => {
  const result = DeleteUserAccountSchema.safeParse({ uid: "" });
  assert.strictEqual(result.success, false);
});

console.log("\n--- GetFinanceStatsSchema ---");
test("accepts valid date range", () => {
  const result = GetFinanceStatsSchema.safeParse({ startDate: "2026-01-01", endDate: "2026-03-01" });
  assert.strictEqual(result.success, true);
});
test("accepts empty (no dates)", () => {
  const result = GetFinanceStatsSchema.safeParse({});
  assert.strictEqual(result.success, true);
});
test("rejects invalid date format", () => {
  const result = GetFinanceStatsSchema.safeParse({ startDate: "not-a-date" });
  assert.strictEqual(result.success, false);
});

console.log(`\n✅ Passed: ${passed} | ❌ Failed: ${failed}\n`);
if (failed > 0) process.exit(1);
