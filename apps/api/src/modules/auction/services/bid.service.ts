import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import { AuctionConfigService } from "./config.service.js";

export class AuctionBidService {
  private config = AuctionConfigService.getInstance().getConfig();

  constructor(
    private prisma: PrismaClient,
    private redis: Redis
  ) {}

  /**
   * Place a bid on an auction item
   * @returns Created bid record
   */
  async placeBid(
    playerId: string,
    itemId: string,
    bidAmount: number
  ) {
    return await this.prisma.$transaction(
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

        if (!currency || currency.ducats < bidAmount) {
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

        // 4. Verify bid is higher than current
        const minBid = this.calculateMinBid(item.currentBid);
        if (bidAmount < minBid) {
          throw new Error(`Bid must be at least ${minBid} ducats`);
        }

        // 5. Deduct ducats (reserve)
        await tx.currencyBalance.update({
          where: { playerId },
          data: { ducats: { decrement: bidAmount } }
        });

        // 6. Create bid record
        const bid = await tx.auctionBid.create({
          data: {
            itemId,
            playerId,
            bidAmount,
            status: "active"
          }
        });

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

        // 9. Refund previous winner
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

        return bid;
      },
      {
        isolationLevel: "Serializable" // Prevent race conditions
      }
    );
  }

  /**
   * Calculate minimum bid based on current bid
   * Rule: MAX(absolute minimum, percentage of current bid) from config
   */
  calculateMinBid(currentBid: number): number {
    if (currentBid === 0) {
      return 1; // First bid can be anything above 0
    }
    const percentIncrement = Math.ceil((currentBid * this.config.bidding.minBidIncrementPercentage) / 100);
    const increment = Math.max(this.config.bidding.minBidIncrementAbsolute, percentIncrement);
    return currentBid + increment;
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
