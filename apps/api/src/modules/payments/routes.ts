import {
  capturePaymentBodySchema,
  capturePaymentResponseSchema,
  createPaymentBodySchema,
  createPaymentResponseSchema,
  IMPERIAL_BUNDLES
} from "@ebonkeep/shared";
import type { FastifyPluginAsync } from "fastify";

import { TransactionService } from "../../services/transactions/transaction.service.js";

export const paymentsRoutes: FastifyPluginAsync = async (fastify) => {
  let transactionService: TransactionService;

  // Initialize transaction service with config from environment
  const initTransactionService = () => {
    if (!transactionService) {
      const config = {
        paypalClientId: process.env.PAYPAL_CLIENT_ID ?? "",
        paypalClientSecret: process.env.PAYPAL_CLIENT_SECRET ?? "",
        paypalSandbox: process.env.PAYPAL_SANDBOX === "true",
        paypalReturnUrl: process.env.PAYPAL_RETURN_URL ?? "http://localhost:5173/",
        paypalCancelUrl: process.env.PAYPAL_CANCEL_URL ?? "http://localhost:5173/"
      };

      // Validate required config
      if (!config.paypalClientId || !config.paypalClientSecret) {
        throw new Error("PayPal credentials not configured");
      }

      transactionService = new TransactionService(fastify.prisma, config);
    }
    return transactionService;
  };

  /**
   * GET /v1/payments/bundles
   * Get available imperial bundles
   */
  fastify.get("/v1/payments/bundles", async (_request, reply) => {
    return reply.send({ bundles: IMPERIAL_BUNDLES });
  });

  /**
   * POST /v1/payments/create
   * Create a PayPal payment order
   * Requires authentication
   */
  fastify.post(
    "/v1/payments/create",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const accountId = request.user.accountId;

      try {
        const body = createPaymentBodySchema.parse(request.body ?? {});
        const service = initTransactionService();

        const result = await service.createPayment(accountId, body.bundleId);

        return reply.send(createPaymentResponseSchema.parse(result));
      } catch (error) {
        fastify.log.error(error, "Failed to create payment");
        return reply.code(500).send({
          error: error instanceof Error ? error.message : "Failed to create payment"
        });
      }
    }
  );

  /**
   * POST /v1/payments/capture
   * Capture a PayPal payment after user approval
   * Requires authentication
   */
  fastify.post(
    "/v1/payments/capture",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        const body = capturePaymentBodySchema.parse(request.body ?? {});
        const service = initTransactionService();

        const result = await service.capturePayment(body.orderId);

        if (!result.success) {
          return reply.code(400).send({
            error: result.message ?? "Payment capture failed"
          });
        }

        return reply.send(capturePaymentResponseSchema.parse(result));
      } catch (error) {
        fastify.log.error(error, "Failed to capture payment");
        return reply.code(500).send({
          error: error instanceof Error ? error.message : "Failed to capture payment"
        });
      }
    }
  );

  /**
   * POST /v1/payments/cancel
   * Cancel a pending payment
   * Requires authentication
   */
  fastify.post(
    "/v1/payments/cancel",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        const body = capturePaymentBodySchema.parse(request.body ?? {});
        const service = initTransactionService();

        await service.cancelTransaction(body.orderId);

        return reply.send({ success: true, message: "Payment cancelled" });
      } catch (error) {
        fastify.log.error(error, "Failed to cancel payment");
        return reply.code(500).send({
          error: error instanceof Error ? error.message : "Failed to cancel payment"
        });
      }
    }
  );

  /**
   * GET /v1/payments/history
   * Get transaction history for current user
   * Requires authentication
   */
  fastify.get(
    "/v1/payments/history",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const accountId = request.user.accountId;

      try {
        const service = initTransactionService();
        const transactions = await service.getAccountTransactions(accountId);

        return reply.send({ transactions });
      } catch (error) {
        fastify.log.error(error, "Failed to fetch transaction history");
        return reply.code(500).send({
          error: error instanceof Error ? error.message : "Failed to fetch transaction history"
        });
      }
    }
  );

  /**
   * POST /v1/payments/webhook/paypal
   * Handle PayPal webhook events
   * This endpoint should be publicly accessible but verify webhook signature
   */
  fastify.post("/v1/payments/webhook/paypal", async (request, reply) => {
    try {
      // TODO: Implement PayPal webhook signature verification
      // https://developer.paypal.com/api/rest/webhooks/
      
      const event = request.body as any;
      fastify.log.info({ event }, "PayPal webhook received");

      // Handle specific event types
      switch (event.event_type) {
        case "PAYMENT.CAPTURE.COMPLETED":
          // Payment was captured successfully
          fastify.log.info("Payment capture completed via webhook");
          break;
        case "PAYMENT.CAPTURE.DENIED":
          // Payment was denied
          fastify.log.warn("Payment capture denied via webhook");
          break;
        default:
          fastify.log.info(`Unhandled webhook event type: ${event.event_type}`);
      }

      return reply.send({ received: true });
    } catch (error) {
      fastify.log.error(error, "Failed to process PayPal webhook");
      return reply.code(500).send({ error: "Webhook processing failed" });
    }
  });
};
