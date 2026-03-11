import { z } from "zod";

import { currencyBalanceSchema } from "../../core/index.js";
import { inventoryItemSchema } from "../inventory/index.js";
import { playerStateSchema } from "../player/index.js";

export const merchantOfferSchema = z.object({
  offerId: z.string(),
  offerIndex: z.number().int().min(0),
  item: inventoryItemSchema,
  buyPriceDucats: z.number().int().min(0),
  sold: z.boolean(),
  refreshAt: z.string()
});
export type MerchantOffer = z.infer<typeof merchantOfferSchema>;

export const merchantStateSchema = z.object({
  offers: z.array(merchantOfferSchema),
  sellPrices: z.record(z.string(), z.number().int().min(0)),
  nextRefreshAt: z.string(),
  currency: currencyBalanceSchema
});
export type MerchantState = z.infer<typeof merchantStateSchema>;

export const merchantBuyBodySchema = z.object({
  offerId: z.string()
});
export type MerchantBuyBody = z.infer<typeof merchantBuyBodySchema>;

export const merchantSellBodySchema = z.object({
  itemId: z.string(),
  fromSlot: z.string()
});
export type MerchantSellBody = z.infer<typeof merchantSellBodySchema>;

export const merchantRestockBodySchema = z.object({}).default({});
export type MerchantRestockBody = z.infer<typeof merchantRestockBodySchema>;

export const merchantTransactionResponseSchema = z.object({
  playerState: playerStateSchema,
  merchantState: merchantStateSchema
});
export type MerchantTransactionResponse = z.infer<typeof merchantTransactionResponseSchema>;

export const merchantStateResponseSchema = merchantStateSchema;
export type MerchantStateResponse = z.infer<typeof merchantStateResponseSchema>;

export const startJobBodySchema = z.object({
  jobType: z.enum(["short", "medium", "long"])
});
export type StartJobBody = z.infer<typeof startJobBodySchema>;

export const startJobResponseSchema = z.object({
  jobRunId: z.string(),
  completeAt: z.string()
});
export type StartJobResponse = z.infer<typeof startJobResponseSchema>;

export const shopPurchaseBodySchema = z.object({
  offerId: z.string(),
  quantity: z.number().int().min(1).max(99).default(1)
});
export type ShopPurchaseBody = z.infer<typeof shopPurchaseBodySchema>;

export const shopPurchaseResponseSchema = z.object({
  purchased: z.boolean(),
  offerId: z.string()
});
export type ShopPurchaseResponse = z.infer<typeof shopPurchaseResponseSchema>;

export const imperialBundleSchema = z.object({
  id: z.string(),
  name: z.string(),
  imperials: z.number().int().positive(),
  price: z.number().positive(),
  currency: z.string().default("USD")
});
export type ImperialBundle = z.infer<typeof imperialBundleSchema>;

export const IMPERIAL_BUNDLES: readonly ImperialBundle[] = [
  { id: "bundle_100", name: "100 Imperials", imperials: 100, price: 5.0, currency: "USD" },
  { id: "bundle_400", name: "330 Imperials", imperials: 330, price: 15.0, currency: "USD" },
  { id: "bundle_900", name: "700 Imperials", imperials: 700, price: 30.0, currency: "USD" },
  { id: "bundle_3000", name: "2,100 Imperials", imperials: 2100, price: 90.0, currency: "USD" },
  { id: "bundle_12000", name: "7,000 Imperials", imperials: 7000, price: 300.0, currency: "USD" }
] as const;

export const createPaymentBodySchema = z.object({
  bundleId: z.string()
});
export type CreatePaymentBody = z.infer<typeof createPaymentBodySchema>;

export const createPaymentResponseSchema = z.object({
  orderId: z.string(),
  approvalUrl: z.string().optional()
});
export type CreatePaymentResponse = z.infer<typeof createPaymentResponseSchema>;

export const capturePaymentBodySchema = z.object({
  orderId: z.string()
});
export type CapturePaymentBody = z.infer<typeof capturePaymentBodySchema>;

export const capturePaymentResponseSchema = z.object({
  success: z.boolean(),
  transactionId: z.string(),
  imperials: z.number().int().positive(),
  message: z.string().optional()
});
export type CapturePaymentResponse = z.infer<typeof capturePaymentResponseSchema>;

export const transactionStatusSchema = z.enum(["pending", "completed", "failed", "cancelled"]);
export type TransactionStatus = z.infer<typeof transactionStatusSchema>;

export const transactionSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  provider: z.string(),
  providerOrderId: z.string(),
  status: transactionStatusSchema,
  amount: z.string(),
  currency: z.string(),
  imperials: z.number().int(),
  createdAt: z.string(),
  completedAt: z.string().nullable()
});
export type Transaction = z.infer<typeof transactionSchema>;
