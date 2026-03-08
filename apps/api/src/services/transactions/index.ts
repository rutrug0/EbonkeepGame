/**
 * Ebonkeep Transaction Module
 * 
 * Handles cross-platform microtransactions with PayPal integration.
 * Designed to be extended for Steam, iOS App Store, and Google Play Store.
 */

export { PayPalClient } from "./paypal.client.js";
export { TransactionService, type TransactionServiceConfig } from "./transaction.service.js";
export type {
  PayPalAmount,
  PayPalApplicationContext,
  PayPalCaptureResponse,
  PayPalLinkDescription,
  PayPalOrderRequest,
  PayPalOrderResponse,
  PayPalPurchaseUnit,
  PayPalWebhookEvent
} from "./paypal.types.js";
