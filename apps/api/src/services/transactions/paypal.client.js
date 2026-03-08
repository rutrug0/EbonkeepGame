"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayPalClient = void 0;
/**
 * PayPal REST API client for Orders v2
 * https://developer.paypal.com/docs/api/orders/v2/
 */
class PayPalClient {
    clientId;
    clientSecret;
    baseUrl;
    accessToken = null;
    tokenExpiresAt = null;
    constructor(options) {
        this.clientId = options.clientId;
        this.clientSecret = options.clientSecret;
        this.baseUrl = options.sandbox
            ? "https://api-m.sandbox.paypal.com"
            : "https://api-m.paypal.com";
    }
    /**
     * Get OAuth 2.0 access token
     */
    async getAccessToken() {
        // Return cached token if valid for at least 60 more seconds
        if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt - 60000) {
            return this.accessToken;
        }
        const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
        const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
            method: "POST",
            headers: {
                "Authorization": `Basic ${auth}`,
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: "grant_type=client_credentials"
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`PayPal authentication failed: ${error}`);
        }
        const data = await response.json();
        this.accessToken = data.access_token;
        this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
        return this.accessToken;
    }
    /**
     * Create a PayPal order
     */
    async createOrder(orderRequest) {
        const token = await this.getAccessToken();
        const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(orderRequest)
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`PayPal create order failed: ${error}`);
        }
        return await response.json();
    }
    /**
     * Capture payment for an approved order
     */
    async captureOrder(orderId) {
        const token = await this.getAccessToken();
        const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${orderId}/capture`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`PayPal capture order failed: ${error}`);
        }
        return await response.json();
    }
    /**
     * Get order details
     */
    async getOrder(orderId) {
        const token = await this.getAccessToken();
        const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${orderId}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`PayPal get order failed: ${error}`);
        }
        return await response.json();
    }
}
exports.PayPalClient = PayPalClient;
