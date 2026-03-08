import type { PayPalCaptureResponse, PayPalOrderRequest, PayPalOrderResponse } from "./paypal.types";
/**
 * PayPal REST API client for Orders v2
 * https://developer.paypal.com/docs/api/orders/v2/
 */
export declare class PayPalClient {
    private readonly clientId;
    private readonly clientSecret;
    private readonly baseUrl;
    private accessToken;
    private tokenExpiresAt;
    constructor(options: {
        clientId: string;
        clientSecret: string;
        sandbox?: boolean;
    });
    /**
     * Get OAuth 2.0 access token
     */
    private getAccessToken;
    /**
     * Create a PayPal order
     */
    createOrder(orderRequest: PayPalOrderRequest): Promise<PayPalOrderResponse>;
    /**
     * Capture payment for an approved order
     */
    captureOrder(orderId: string): Promise<PayPalCaptureResponse>;
    /**
     * Get order details
     */
    getOrder(orderId: string): Promise<PayPalOrderResponse>;
}
