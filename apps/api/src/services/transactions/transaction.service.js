"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionService = void 0;
const shared_1 = require("@ebonkeep/shared");
const paypal_client_1 = require("./paypal.client");
class TransactionService {
    prisma;
    paypalClient;
    config;
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
        this.paypalClient = new paypal_client_1.PayPalClient({
            clientId: config.paypalClientId,
            clientSecret: config.paypalClientSecret,
            sandbox: config.paypalSandbox
        });
    }
    /**
     * Get bundle by ID
     */
    getBundle(bundleId) {
        return shared_1.IMPERIAL_BUNDLES.find((bundle) => bundle.id === bundleId);
    }
    /**
     * Create a PayPal payment order
     */
    async createPayment(accountId, bundleId) {
        const bundle = this.getBundle(bundleId);
        if (!bundle) {
            throw new Error(`Invalid bundle ID: ${bundleId}`);
        }
        // Create PayPal order
        const orderRequest = {
            intent: "CAPTURE",
            purchase_units: [
                {
                    reference_id: bundleId,
                    description: bundle.name,
                    custom_id: accountId,
                    amount: {
                        currency_code: bundle.currency,
                        value: bundle.price.toFixed(2)
                    }
                }
            ],
            application_context: {
                brand_name: "Ebonkeep",
                locale: "en-US",
                landing_page: "NO_PREFERENCE",
                shipping_preference: "NO_SHIPPING",
                user_action: "PAY_NOW",
                return_url: this.config.paypalReturnUrl,
                cancel_url: this.config.paypalCancelUrl
            }
        };
        const paypalOrder = await this.paypalClient.createOrder(orderRequest);
        // Save transaction to database with pending status
        await this.prisma.transaction.create({
            data: {
                accountId,
                provider: "paypal",
                providerOrderId: paypalOrder.id,
                status: "pending",
                amount: bundle.price.toFixed(2),
                currency: bundle.currency,
                imperials: bundle.imperials,
                metadata: {
                    bundleId: bundle.id,
                    bundleName: bundle.name
                }
            }
        });
        // Find approval URL
        const approvalLink = paypalOrder.links.find((link) => link.rel === "approve");
        if (!approvalLink) {
            throw new Error("PayPal approval URL not found");
        }
        return {
            orderId: paypalOrder.id,
            approvalUrl: approvalLink.href
        };
    }
    /**
     * Capture a PayPal payment and credit imperials
     */
    async capturePayment(orderId) {
        // Find transaction in database
        const transaction = await this.prisma.transaction.findUnique({
            where: { providerOrderId: orderId },
            include: { account: { include: { profiles: { include: { currency: true } } } } }
        });
        if (!transaction) {
            throw new Error("Transaction not found");
        }
        if (transaction.status === "completed") {
            return {
                success: true,
                transactionId: transaction.id,
                imperials: transaction.imperials,
                message: "Transaction already completed"
            };
        }
        if (transaction.status === "failed" || transaction.status === "cancelled") {
            return {
                success: false,
                transactionId: transaction.id,
                imperials: 0,
                message: `Transaction ${transaction.status}`
            };
        }
        try {
            // Capture payment from PayPal
            const captureResponse = await this.paypalClient.captureOrder(orderId);
            if (captureResponse.status !== "COMPLETED") {
                await this.prisma.transaction.update({
                    where: { id: transaction.id },
                    data: {
                        status: "failed",
                        metadata: {
                            ...transaction.metadata,
                            captureStatus: captureResponse.status
                        }
                    }
                });
                return {
                    success: false,
                    transactionId: transaction.id,
                    imperials: 0,
                    message: `Payment ${captureResponse.status.toLowerCase()}`
                };
            }
            // Update transaction as completed
            const updatedTransaction = await this.prisma.transaction.update({
                where: { id: transaction.id },
                data: {
                    status: "completed",
                    completedAt: new Date(),
                    providerPayerId: captureResponse.payer?.payer_id,
                    metadata: {
                        ...transaction.metadata,
                        captureId: captureResponse.purchase_units[0]?.payments?.captures?.[0]?.id,
                        payerEmail: captureResponse.payer?.email_address
                    }
                }
            });
            // Credit imperials to all player profiles for this account
            // Update or create currency balance for each profile
            for (const profile of transaction.account.profiles) {
                await this.prisma.currencyBalance.upsert({
                    where: { playerId: profile.id },
                    update: {
                        imperials: {
                            increment: transaction.imperials
                        }
                    },
                    create: {
                        playerId: profile.id,
                        ducats: 0,
                        imperials: transaction.imperials
                    }
                });
            }
            return {
                success: true,
                transactionId: updatedTransaction.id,
                imperials: transaction.imperials,
                message: "Payment completed successfully"
            };
        }
        catch (error) {
            // Update transaction as failed
            await this.prisma.transaction.update({
                where: { id: transaction.id },
                data: {
                    status: "failed",
                    metadata: {
                        ...transaction.metadata,
                        error: error instanceof Error ? error.message : "Unknown error"
                    }
                }
            });
            throw error;
        }
    }
    /**
     * Cancel a pending transaction
     */
    async cancelTransaction(orderId) {
        await this.prisma.transaction.updateMany({
            where: {
                providerOrderId: orderId,
                status: "pending"
            },
            data: {
                status: "cancelled"
            }
        });
    }
    /**
     * Get transaction history for an account
     */
    async getAccountTransactions(accountId, limit = 20) {
        return this.prisma.transaction.findMany({
            where: { accountId },
            orderBy: { createdAt: "desc" },
            take: limit
        });
    }
}
exports.TransactionService = TransactionService;
