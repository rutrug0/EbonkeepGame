import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AuctionInstanceService } from "./services/instance.service.js";
import { AuctionBidService } from "./services/bid.service.js";
import { AuctionSettlementService } from "./services/settlement.service.js";
import { PlayerSubmissionService } from "./services/player-submission.service.js";
import { AuctionConfigService } from "./services/config.service.js";
import { buildInventoryItemRecordFromAuctionPayload } from "./services/item-payload.service.js";

/**
 * Type declarations for Fastify decorators
 * Copy types.d.ts to your API project for full type support
 * 
 * Required decorators:
 * - fastify.prisma: PrismaClient
 * - fastify.redis: Redis
 * - fastify.authenticate: Auth middleware
 * - fastify.requireAdmin: Admin check middleware
 * - request.user: { playerId: string, level: number }
 */

// Request/response schemas
const placeBidSchema = z.object({
  itemId: z.string(),
  bidAmount: z.number().int().positive()
});

const enableAutoBidSchema = z.object({
  itemId: z.string(),
  maxBid: z.number().int().positive()
});

const disableAutoBidSchema = z.object({
  itemId: z.string()
});

const submitItemSchema = z.object({
  itemData: z.any(),
  desiredStartingBid: z.number().int().positive()
});

const approveSubmissionSchema = z.object({
  listingId: z.string()
});

const rejectSubmissionSchema = z.object({
  listingId: z.string(),
  reason: z.string(),
  refundListingFee: z.boolean().optional()
});

const claimRewardSchema = z.object({
  rewardId: z.string()
});

export const auctionRoutes: FastifyPluginAsync = async (fastify) => {
  const config = AuctionConfigService.getInstance().getConfig();
  const instanceService = new AuctionInstanceService(fastify.prisma);
  const bidService = new AuctionBidService(fastify.prisma, fastify.redis);
  const settlementService = new AuctionSettlementService(fastify.prisma);
  const submissionService = new PlayerSubmissionService(fastify.prisma);

  /**
   * GET /v1/auction/active
   * Get active auctions for player's level bracket (max 3)
   */
  fastify.get(
    "/v1/auction/active",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const auctions = await instanceService.getActiveAuctionsForPlayer(
        request.user.playerId
      );
      return reply.send({ auctions });
    }
  );

  /**
   * GET /v1/auction/:auctionId
   * Get detailed view of specific auction with player's bid status
   */
  fastify.get<{ Params: { auctionId: string } }>(
    "/v1/auction/:auctionId",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const auction = await instanceService.getAuctionDetails(
        request.params.auctionId,
        request.user.playerId
      );
      return reply.send({ auction });
    }
  );

  /**
   * POST /v1/auction/bid
   * Place a bid on an auction item
   */
  fastify.post(
    "/v1/auction/bid",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const body = placeBidSchema.parse(request.body);

      try {
        const result = await bidService.placeBid(
          request.user.playerId,
          body.itemId,
          body.bidAmount
        );

        // Log telemetry
        fastify.log.info({
          event: "auction.bid.placed",
          playerId: request.user.playerId,
          itemId: body.itemId,
          bidAmount: body.bidAmount
        });

        return reply.send({
          success: true,
          remainingDucats: result.remainingDucats
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.code(400).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  /**
   * GET /v1/auction/item/:itemId/bids
   * Get bid history for an item (last 5 bids, anonymous)
   */
  fastify.get<{ Params: { itemId: string } }>(
    "/v1/auction/item/:itemId/bids",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const bids = await bidService.getBidHistory(request.params.itemId, 5);
      return reply.send({ bids });
    }
  );

  /**
   * GET /v1/auction/my-activity
   * Get player's auction activity summary
   */
  fastify.get(
    "/v1/auction/my-activity",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const activity = await instanceService.getPlayerActivity(request.user.playerId);
      return reply.send({ activity });
    }
  );

  /**
   * GET /v1/auction/my-bids
   * Get all active bids by player
   */
  fastify.get(
    "/v1/auction/my-bids",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const bids = await bidService.getPlayerActiveBids(request.user.playerId);
      return reply.send({ bids });
    }
  );

  /**
   * POST /v1/auction/autobid/enable
   * Enable auto-bidding for an item with a maximum bid
   */
  fastify.post(
    "/v1/auction/autobid/enable",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const body = enableAutoBidSchema.parse(request.body);

      try {
        const result = await bidService.enableAutoBid(
          request.user.playerId,
          body.itemId,
          body.maxBid
        );

        fastify.log.info({
          event: "auction.autobid.enabled",
          playerId: request.user.playerId,
          itemId: body.itemId,
          maxBid: body.maxBid
        });

        return reply.send(result);
      } catch (error) {
        if (error instanceof Error) {
          return reply.code(400).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  /**
   * POST /v1/auction/autobid/disable
   * Disable auto-bidding for an item
   */
  fastify.post(
    "/v1/auction/autobid/disable",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const body = disableAutoBidSchema.parse(request.body);

      try {
        const result = await bidService.disableAutoBid(
          request.user.playerId,
          body.itemId
        );

        fastify.log.info({
          event: "auction.autobid.disabled",
          playerId: request.user.playerId,
          itemId: body.itemId
        });

        return reply.send(result);
      } catch (error) {
        if (error instanceof Error) {
          return reply.code(400).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  /**
   * GET /v1/auction/rewards/pending
   * Get player's unclaimed auction rewards
   */
  fastify.get(
    "/v1/auction/rewards/pending",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const rewards = await fastify.prisma.auctionPendingReward.findMany({
        where: {
          playerId: request.user.playerId,
          claimed: false
        },
        orderBy: { createdAt: "desc" }
      });
      return reply.send({ rewards });
    }
  );

  /**
   * POST /v1/auction/rewards/claim
   * Claim a pending auction reward
   */
  fastify.post(
    "/v1/auction/rewards/claim",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const body = claimRewardSchema.parse(request.body);

      return await fastify.prisma.$transaction(async (tx: any) => {
        // Fetch reward
        const reward = await tx.auctionPendingReward.findUnique({
          where: { id: body.rewardId }
        });

        if (!reward || reward.playerId !== request.user.playerId) {
          return reply.code(404).send({ error: "Reward not found" });
        }

        if (reward.claimed) {
          return reply.code(400).send({ error: "Reward already claimed" });
        }

        // Check expiry
        if (new Date() > reward.expiresAt) {
          return reply.code(400).send({
            error: "Reward has expired",
            expiredAt: reward.expiresAt.toISOString()
          });
        }

        // Check inventory space (simplified for V1)
        // TODO: Replace with actual inventory space check
        const inventoryCount = await tx.inventoryItem.count({
          where: { playerId: request.user.playerId }
        });

        const maxInventory = 200; // TODO: Get from player data
        if (inventoryCount >= maxInventory) {
          return reply.code(400).send({ error: "Inventory full" });
        }

        // Add item to inventory
        const inventoryItem = await tx.inventoryItem.create({
          data: buildInventoryItemRecordFromAuctionPayload({
            playerId: request.user.playerId,
            storedItemCode: reward.itemCode
          })
        });

        // Mark reward as claimed
        await tx.auctionPendingReward.update({
          where: { id: body.rewardId },
          data: {
            claimed: true,
            claimedAt: new Date()
          }
        });

        // Log telemetry
        fastify.log.info({
          event: "auction.reward.claimed",
          playerId: request.user.playerId,
          rewardId: body.rewardId,
          itemCode: reward.itemCode
        });

        return reply.send({
          success: true,
          inventoryItem: {
            id: inventoryItem.id,
            itemCode: inventoryItem.itemCode
          }
        });
      });
    }
  );

  /**
   * POST /v1/auction/submit
   * Submit a player-owned item to the auction house
   */
  fastify.post(
    "/v1/auction/submit",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const body = submitItemSchema.parse(request.body);

      try {
        const listingId = await submissionService.submitItem(
          request.user.playerId,
          body.itemData,
          body.desiredStartingBid
        );

        fastify.log.info({
          event: "auction.item.submitted",
          playerId: request.user.playerId,
          listingId,
          desiredBid: body.desiredStartingBid
        });

        return reply.send({
          success: true,
          listingId,
          message: "Item submitted for moderation"
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.code(400).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  /**
   * GET /v1/auction/my-submissions
   * Get player's item submission history
   */
  fastify.get(
    "/v1/auction/my-submissions",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const submissions = await submissionService.getPlayerSubmissions(
        request.user.playerId
      );
      return reply.send({ submissions });
    }
  );

  /**
   * POST /v1/auction/submit/:listingId/cancel
   * Cancel a pending item submission
   */
  fastify.post<{ Params: { listingId: string } }>(
    "/v1/auction/submit/:listingId/cancel",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        await submissionService.cancelSubmission(
          request.user.playerId,
          request.params.listingId
        );

        return reply.send({ success: true });
      } catch (error) {
        if (error instanceof Error) {
          return reply.code(400).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  /* ========== ADMIN ROUTES ========== */

  /**
   * GET /v1/auction/admin/submissions/pending
   * Get all pending item submissions (admin/moderator only)
   */
  fastify.get(
    "/v1/auction/admin/submissions/pending",
    { preHandler: [fastify.authenticate, fastify.requireAdmin] },
    async (request, reply) => {
      const pending = await submissionService.getPendingSubmissions();
      return reply.send({ submissions: pending });
    }
  );

  /**
   * POST /v1/auction/admin/submissions/approve
   * Approve a pending item submission (admin/moderator only)
   */
  fastify.post(
    "/v1/auction/admin/submissions/approve",
    { preHandler: [fastify.authenticate, fastify.requireAdmin] },
    async (request, reply) => {
      const body = approveSubmissionSchema.parse(request.body);

      await submissionService.approveSubmission(
        body.listingId,
        request.user.playerId
      );

      fastify.log.info({
        event: "auction.submission.approved",
        adminId: request.user.playerId,
        listingId: body.listingId
      });

      return reply.send({ success: true });
    }
  );

  /**
   * POST /v1/auction/admin/submissions/reject
   * Reject a pending item submission (admin/moderator only)
   */
  fastify.post(
    "/v1/auction/admin/submissions/reject",
    { preHandler: [fastify.authenticate, fastify.requireAdmin] },
    async (request, reply) => {
      const body = rejectSubmissionSchema.parse(request.body);

      await submissionService.rejectSubmission(
        body.listingId,
        request.user.playerId,
        body.reason,
        body.refundListingFee ?? true
      );

      fastify.log.info({
        event: "auction.submission.rejected",
        adminId: request.user.playerId,
        listingId: body.listingId,
        reason: body.reason
      });

      return reply.send({ success: true });
    }
  );

  /* ========== TEST/DEBUG ROUTES ========== */

  /**
   * POST /v1/auction/test/create-auctions
   * Manually trigger auction creation (for testing)
   */
  fastify.post("/v1/auction/test/create-auctions", async (request, reply) => {
    try {
      await instanceService.createAuctionInstances();
      return reply.send({ success: true, message: "Auctions created" });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  });

  /**
   * POST /v1/auction/test/reroll-auctions
   * Clear active auctions and regenerate them from current rules (development only)
   */
  fastify.post("/v1/auction/test/reroll-auctions", async (request, reply) => {
    try {
      const result = await instanceService.rerollActiveAuctions();
      return reply.send({
        success: true,
        message: "Auctions rerolled",
        ...result
      });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  });

  /**
   * GET /v1/auction/config
   * Get current auction configuration (for debugging)
   */
  fastify.get("/v1/auction/config", async (request, reply) => {
    const sanitized = {
      ...config,
      // Don't expose sensitive config values if any
    };
    return reply.send({ config: sanitized });
  });
};

