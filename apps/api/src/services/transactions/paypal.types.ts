/**
 * PayPal REST API type definitions
 * Documentation: https://developer.paypal.com/api/rest/
 */

export interface PayPalAmount {
  currency_code: string;
  value: string;
}

export interface PayPalPurchaseUnit {
  reference_id?: string;
  description?: string;
  custom_id?: string;
  amount: PayPalAmount;
}

export interface PayPalApplicationContext {
  brand_name?: string;
  locale?: string;
  landing_page?: "LOGIN" | "BILLING" | "NO_PREFERENCE";
  shipping_preference?: "GET_FROM_FILE" | "NO_SHIPPING" | "SET_PROVIDED_ADDRESS";
  user_action?: "CONTINUE" | "PAY_NOW";
  return_url?: string;
  cancel_url?: string;
}

export interface PayPalOrderRequest {
  intent: "CAPTURE" | "AUTHORIZE";
  purchase_units: PayPalPurchaseUnit[];
  application_context?: PayPalApplicationContext;
}

export interface PayPalLinkDescription {
  href: string;
  rel: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
}

export interface PayPalOrderResponse {
  id: string;
  status: "CREATED" | "SAVED" | "APPROVED" | "VOIDED" | "COMPLETED" | "PAYER_ACTION_REQUIRED";
  links: PayPalLinkDescription[];
}

export interface PayPalCaptureResponse {
  id: string;
  status: "COMPLETED" | "DECLINED" | "PARTIALLY_REFUNDED" | "PENDING" | "REFUNDED";
  purchase_units: Array<{
    reference_id?: string;
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
        amount: PayPalAmount;
      }>;
    };
  }>;
  payer?: {
    email_address?: string;
    payer_id?: string;
  };
}

export interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource_type: string;
  resource: any;
  summary: string;
  create_time: string;
}
