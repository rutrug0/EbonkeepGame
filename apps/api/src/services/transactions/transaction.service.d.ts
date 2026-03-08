import type { PrismaClient } from "@prisma/client";
export interface TransactionServiceConfig {
    paypalClientId: string;
    paypalClientSecret: string;
    paypalSandbox: boolean;
    paypalReturnUrl: string;
    paypalCancelUrl: string;
}
export declare class TransactionService {
    private readonly prisma;
    private readonly paypalClient;
    private readonly config;
    constructor(prisma: PrismaClient, config: TransactionServiceConfig);
    /**
     * Get bundle by ID
     */
    private getBundle;
    /**
     * Create a PayPal payment order
     */
    createPayment(accountId: string, bundleId: string): Promise<{
        orderId: string;
        approvalUrl: string;
    }>;
    /**
     * Capture a PayPal payment and credit imperials
     */
    capturePayment(orderId: string): Promise<{
        success: boolean;
        transactionId: string;
        imperials: number;
        message?: string;
    }>;
    /**
     * Cancel a pending transaction
     */
    cancelTransaction(orderId: string): Promise<void>;
    /**
     * Get transaction history for an account
     */
    getAccountTransactions(accountId: string, limit?: number): Promise<{
        id: string;
        accountId: string;
        provider: string;
        providerOrderId: string;
        providerPayerId: string | null;
        status: string;
        amount: string;
        currency: string;
        imperials: number;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
        completedAt: Date | null;
    }[]>;
}
