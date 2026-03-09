import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import { AuctionConfigService } from "./config.service.js";

export class AuctionBidService {
  private configService = AuctionConfigService.getInstance();
  private config = this.configService.getConfig();

  constructor(
    private prisma: PrismaClient,
    private redis: Redis
  ) {}

  /**
   * Place a bid on an auction item.
   * Returns the created bid and the player's remaining available ducats.
   * Triggers auto-bids after successful placement.
   */
  async placeBid(
    playerId: string,
    itemId: string,
    bidAmount: number,
    skipAutoBidTrigger: boolean = false
  ) {
    const result = await this.prisma.$transaction(
      async (tx: any) => {
        // 1. Check rate limit (from config)
        const rateLimitKey = `bid:rate:${playerId}`;
        const bidCount = await this.redis.incr(rateLimitKey);
        await this.redis.expire(rateLimitKey, 60);
        if (bidCount > this.config.bidding.maxBidsPerMinute) {
          throw new Error(`Rate limit exceeded: max ${this.config.bidding.maxBidsPerMinute} bids per minute`);
        }

        // 2. Load player currency
        const currency = await tx.currencyBalance.findUnique({
          where: { playerId },
          select: { ducats: true }
        });

        if (!currency) {
          throw new Error("Insufficient ducats");
        }

        // 3. Load item with auction
        const item = await tx.auctionItem.findUnique({
          where: { id: itemId },
          include: { auctionInstance: true }
        });

        if (!item) {
          throw new Error("Item not found");
        }

        if (item.auctionInstance.status !== "active") {
          throw new Error("Auction is not active");
        }

        // 4. Verify bid reaches the actual floor for this item.
        const minBid = this.calculateMinBid(item.currentBid, item.startingBid);
        if (bidAmount < minBid) {
          throw new Error(`Bid must be at least ${minBid} ducats`);
        }

        // 5. If the same player is raising their own leading bid, reserve only the difference.
        const existingPlayerBid = await tx.auctionBid.findFirst({
          where: {
            itemId,
            playerId,
            status: "active"
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            bidAmount: true,
            maxAutoBid: true
          }
        });

        const currentlyReserved = existingPlayerBid?.bidAmount ?? 0;
        const additionalReserve = Math.max(0, bidAmount - currentlyReserved);

        if (currency.ducats < additionalReserve) {
          throw new Error("Insufficient ducats");
        }

        if (additionalReserve > 0) {
          await tx.currencyBalance.update({
            where: { playerId },
            data: { ducats: { decrement: additionalReserve } }
          });
        }

        if (existingPlayerBid) {
          await tx.auctionBid.update({
            where: { id: existingPlayerBid.id },
            data: { 
              bidAmount,
              status: "active",
              // Keep auto-bid settings if they exist
              isAutoBid: existingPlayerBid.maxAutoBid ? true : false,
              maxAutoBid: existingPlayerBid.maxAutoBid
            }
          });
        } else {
          // 6. Create bid record
          await tx.auctionBid.create({
            data: {
              itemId,
              playerId,
              bidAmount,
              status: "active"
            }
          });
        }

        // 7. Store previous winner for refund
        const previousWinnerId = item.currentWinnerId;

        // 8. Update item current bid and winner
        await tx.auctionItem.update({
          where: { id: itemId },
          data: {
            currentBid: bidAmount,
            currentWinnerId: playerId,
            bidCount: { increment: 1 }
          }
        });

        // 9. Refund previous winner when another player takes the lead.
        if (previousWinnerId && previousWinnerId !== playerId) {
          await this.refundPreviousBidder(tx, previousWinnerId, itemId);
        }

        // 10. Check for snipe protection (auction extension)
        if (this.config.snipeProtection.enabled) {
          const triggerWindowMs = this.config.snipeProtection.triggerWindowMinutes * 60 * 1000;
          const extensionMs = this.config.snipeProtection.extensionDurationMinutes * 60 * 1000;
          const timeRemaining = item.auctionInstance.endTime.getTime() - Date.now();

          if (timeRemaining < triggerWindowMs && item.extensionsUsed < this.config.snipeProtection.maxExtensionsPerItem) {
            await tx.auctionItem.update({
              where: { id: itemId },
              data: { extensionsUsed: { increment: 1 } }
            });
            await tx.auctionInstance.update({
              where: { id: item.auctionInstanceId },
              data: {
                endTime: new Date(item.auctionInstance.endTime.getTime() + extensionMs)
              }
            });
          }
        }

        return {
          remainingDucats: currency.ducats - additionalReserve
        };
      },
      {
        isolationLevel: "Serializable" // Prevent race conditions
      }
    );

    // 11. Trigger auto-bids AFTER transaction completes (if not skipped)
    if (!skipAutoBidTrigger) {
      // Run in background to avoid blocking the response
      setImmediate(() => {
        this.triggerAutoBids(itemId, playerId).catch(error => {
          console.error(`Auto-bid trigger failed for item ${itemId}:`, error);
        });
      });
    }

    return result;
  }

  /**
   * Enable auto-bidding for an item with a maximum bid amount.
   * Reserves the full maxBid amount immediately.
   */
  async enableAutoBid(
    playerId: string,
    itemId: string,
    maxBid: number
  ) {
    return await this.prisma.$transaction(
      async (tx: any) => {
        // 1. Load item with auction
        const item = await tx.auctionItem.findUnique({
          where: { id: itemId },
          include: { auctionInstance: true }
        });

        if (!item) {
          throw new Error("Item not found");
        }

        if (item.auctionInstance.status !== "active") {
          throw new Error("Auction is not active");
        }

        // 2. Validate maxBid is >= minimum required bid
        const minBid = this.calculateMinBid(item.currentBid, item.startingBid);
        if (maxBid < minBid) {
          throw new Error(`Maximum bid must be at least ${minBid} ducats`);
        }

        // 3. Load player currency
        const currency = await tx.currencyBalance.findUnique({
          where: { playerId },
          select: { ducats: true }
        });

        if (!currency) {
          throw new Error("Insufficient ducats");
        }

        // 4. Check for existing active bid
        const existingBid = await tx.auctionBid.findFirst({
          where: {
            itemId,
            playerId,
            status: "active"
          },
          orderBy: { createdAt: "desc" }
        });

        const currentlyReserved = existingBid?.bidAmount ?? 0;
        const additionalReserve = Math.max(0, maxBid - currentlyReserved);

        if (currency.ducats < additionalReserve) {
          throw new Error("Insufficient ducats for maximum bid");
        }

        // 5. Reserve the full max bid amount
        if (additionalReserve > 0) {
          await tx.currencyBalance.update({
            where: { playerId },
            data: { ducats: { decrement: additionalReserve } }
          });
        }

        // 6. Update or create bid with auto-bid enabled
        if (existingBid) {
          await tx.auctionBid.update({
            where: { id: existingBid.id },
            data: {
              isAutoBid: true,
              maxAutoBid: maxBid
            }
          });
        } else {
          // Place initial bid at minimum if not currently winning
          const initialBidAmount = item.currentWinnerId === playerId ? item.currentBid : minBid;
          
          await tx.auctionBid.create({
            data: {
              itemId,
              playerId,
              bidAmount: initialBidAmount,
              status: "active",
              isAutoBid: true,
              maxAutoBid: maxBid
            }
          });

          // Update item if this is a new bid
          if (item.currentWinnerId !== playerId) {
            const previousWinnerId = item.currentWinnerId;

            await tx.auctionItem.update({
              where: { id: itemId },
              data: {
                currentBid: initialBidAmount,
                currentWinnerId: playerId,
                bidCount: { increment: 1 }
              }
            });

            // Refund previous winner
            if (previousWinnerId) {
              await this.refundPreviousBidder(tx, previousWinnerId, itemId);
            }
          }
        }

        return {
          success: true,
          remainingDucats: currency.ducats - additionalReserve,
          maxBid
        };
      },
      {
        isolationLevel: "Serializable"
      }
    );
  }

  /**
   * Disable auto-bidding for an item.
   * Refunds the difference between current bid and max bid.
   */
  async disableAutoBid(
    playerId: string,
    itemId: string
  ) {
    return await this.prisma.$transaction(
      async (tx: any) => {
        // Find active auto-bid
        const autoBid = await tx.auctionBid.findFirst({
          where: {
            itemId,
            playerId,
            status: "active",
            isAutoBid: true
          },
          orderBy: { createdAt: "desc" }
        });

        if (!autoBid) {
          throw new Error("No active auto-bid found");
        }

        const refundAmount = (autoBid.maxAutoBid ?? autoBid.bidAmount) - autoBid.bidAmount;

        // Update bid to disable auto-bid
        await tx.auctionBid.update({
          where: { id: autoBid.id },
          data: {
            isAutoBid: false,
            maxAutoBid: null
          }
        });

        // Refund excess reserved ducats
        if (refundAmount > 0) {
          await tx.currencyBalance.update({
            where: { playerId },
            data: { ducats: { increment: refundAmount } }
          });
        }

        // Get updated balance
        const updatedBalance = await tx.currencyBalance.findUnique({
          where: { playerId },
          select: { ducats: true }
        });

        return {
          success: true,
          refundedDucats: refundAmount,
          remainingDucats: updatedBalance?.ducats ?? 0
        };
      },
      {
        isolationLevel: "Serializable"
      }
    );
  }

  /**
   * Trigger auto-bids after a manual bid is placed.
   * Checks if any players with auto-bid enabled should counter-bid.
   */
  async triggerAutoBids(itemId: string, newBidderId: string) {
    // Find all active auto-bids for this item (excluding the player who just bid)
    const autoBids = await this.prisma.auctionBid.findMany({
      where: {
        itemId,
        status: "active",
        isAutoBid: true,
        playerId: { not: newBidderId }
      },
      orderBy: { maxAutoBid: "desc" } // Process highest max bid first
    });

    if (autoBids.length === 0) {
      return; // No auto-bids to trigger
    }

    // Get current item state
    const item = await this.prisma.auctionItem.findUnique({
      where: { id: itemId },
      include: { auctionInstance: true }
    });

    if (!item || item.auctionInstance.status !== "active") {
      return;
    }

    // Process auto-bids
    for (const autoBid of autoBids) {
      if (!autoBid.maxAutoBid) continue;

      // Calculate next required bid
      const minBid = this.calculateMinBid(item.currentBid, item.startingBid);

      // Check if auto-bid can afford the next bid
      if (autoBid.maxAutoBid >= minBid && item.currentWinnerId !== autoBid.playerId) {
        try {
          // Place auto-bid at minimum required amount (not exceeding max)
          const autoBidAmount = Math.min(minBid, autoBid.maxAutoBid);
          
          // Skip auto-bid trigger to prevent infinite loop
          await this.placeBid(autoBid.playerId, itemId, autoBidAmount, true);
          
          // Only one auto-bid should trigger per manual bid
          break;
        } catch (error) {
          // If auto-bid fails, continue to next one
          console.error(`Auto-bid failed for player ${autoBid.playerId}:`, error);
          continue;
        }
      }
    }
  }

  /**
   * Calculate minimum bid based on current bid and the item's configured starting bid.
   */
  calculateMinBid(currentBid: number, startingBid: number): number {
    return this.configService.calculateMinBid(currentBid, startingBid);
  }

  /**
   * Refund previous bidder when outbid
   */
  private async refundPreviousBidder(
    tx: any,
    playerId: string,
    itemId: string
  ): Promise<void> {
    // Find previous active bid
    const previousBid = await tx.auctionBid.findFirst({
      where: {
        playerId,
        itemId,
        status: "active"
      },
      orderBy: { createdAt: "desc" }
    });

    if (!previousBid) {
      return; // No active bid found
    }

    // Mark bid as outbid
    await tx.auctionBid.update({
      where: { id: previousBid.id },
      data: { status: "outbid" }
    });

    // Refund ducats
    await tx.currencyBalance.update({
      where: { playerId },
      data: { ducats: { increment: previousBid.bidAmount } }
    });
  }

  /**
   * Get bid history for an item (last N bids)
   */
  async getBidHistory(itemId: string, limit: number = 5) {
    return await this.prisma.auctionBid.findMany({
      where: { itemId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        bidAmount: true,
        createdAt: true
        // Note: playerId intentionally excluded for anonymity
      }
    });
  }

  /**
   * Check if player can afford a bid
   */
  async canPlayerBid(playerId: string, amount: number): Promise<boolean> {
    const currency = await this.prisma.currencyBalance.findUnique({
      where: { playerId },
      select: { ducats: true }
    });
    return currency ? currency.ducats >= amount : false;
  }

  /**
   * Get player's active bids across all auctions
   */
  async getPlayerActiveBids(playerId: string) {
    return await this.prisma.auctionBid.findMany({
      where: {
        playerId,
        status: "active"
      },
      include: {
        item: {
          include: {
            auctionInstance: true
          }
        }
      }
    });
  }
}