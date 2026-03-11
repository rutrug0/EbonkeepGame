import type { Prisma, PrismaClient } from "@prisma/client";
import { AuctionConfigService } from "./config.service.js";

export class AuctionSettlementService {
  private config = AuctionConfigService.getInstance().getConfig();

  constructor(private prisma: PrismaClient) {}

  /**
   * Settle all completed auctions
   * - Award items to winners
   * - Pay sellers (minus auction house fee)
   * - Create pending rewards
   */
  async settleAuctions(): Promise<{
    settledCount: number;
    totalFeesCollected: number;
  }> {
    let settledCount = 0;
    let totalFeesCollected = 0;

    // Find all active auctions past their end time
    const expiredAuctions = await this.prisma.auctionInstance.findMany({
      where: {
        status: "active",
        endTime: { lte: new Date() }
      },
      include: {
        items: {
          include: {
            auctionInstance: true
          }
        }
      }
    });

    for (const auction of expiredAuctions) {
      const { feesCollected, settledItems } = await this.prisma.$transaction(async (tx) => {
        let feesCollected = 0;
        let settledItems = 0;

        for (const item of auction.items) {
          if (item.currentWinnerId) {
            const winningBid = await tx.auctionBid.findFirst({
              where: {
                itemId: item.id,
                playerId: item.currentWinnerId,
                status: "active"
              },
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                bidAmount: true,
                maxAutoBid: true
              }
            });

            if (winningBid) {
              const reservedAmount = this.getReservedAmount(winningBid);
              const refundAmount = Math.max(0, reservedAmount - item.currentBid);

              if (refundAmount > 0) {
                await tx.currencyBalance.update({
                  where: { playerId: item.currentWinnerId },
                  data: { ducats: { increment: refundAmount } }
                });
              }

              await tx.auctionBid.update({
                where: { id: winningBid.id },
                data: {
                  bidAmount: item.currentBid,
                  status: "won"
                }
              });
            }

            await tx.auctionPendingReward.create({
              data: {
                playerId: item.currentWinnerId,
                itemId: item.id,
                itemCode: item.itemCode,
                auctionId: item.auctionInstanceId,
                winningBid: item.currentBid,
                expiresAt: new Date(
                  Date.now() + this.config.rewards.pendingRewardExpiryDays * 24 * 60 * 60 * 1000
                )
              }
            });

            if (item.isPlayerSubmitted && item.sellerId) {
              const { fee, sellerProceeds } = this.calculateSellerProceeds(
                item.currentBid,
                item.feePercentage
              );

              await tx.currencyBalance.update({
                where: { playerId: item.sellerId },
                data: { ducats: { increment: sellerProceeds } }
              });

              feesCollected += fee;
            }
          } else if (item.isPlayerSubmitted && item.sellerId) {
            await this.returnItemToSeller(tx, item.id, item.sellerId, item.itemCode, auction.id);
          }

          settledItems++;
        }

        await tx.auctionInstance.update({
          where: { id: auction.id },
          data: { status: "completed" }
        });

        return { feesCollected, settledItems };
      });

      settledCount += settledItems;
      totalFeesCollected += feesCollected;
    }

    return { settledCount, totalFeesCollected };
  }

  /**
   * Calculate seller proceeds after deducting auction house fee
   */
  private calculateSellerProceeds(
    winningBid: number,
    feePercentage: number
  ): { fee: number; sellerProceeds: number } {
    const fee = Math.floor((winningBid * feePercentage) / 100);
    const sellerProceeds = winningBid - fee;
    return { fee, sellerProceeds };
  }

  /**
   * Return unsold item to seller's inventory
   * This is a placeholder - integrate with your inventory system
   */
  private async returnItemToSeller(
    tx: Prisma.TransactionClient,
    itemId: string,
    sellerId: string,
    itemData: any,
    auctionId: string
  ): Promise<void> {
    // TODO: Integrate with inventory system
    // For now, create a pending reward so seller can claim it back
    await tx.auctionPendingReward.create({
      data: {
        playerId: sellerId,
        itemId,
        itemCode: itemData,
        auctionId,
        winningBid: 0, // No payment for unsold item
        expiresAt: new Date(
          Date.now() + this.config.rewards.pendingRewardExpiryDays * 24 * 60 * 60 * 1000
        )
      }
    });
  }

  private getReservedAmount(bid: { bidAmount: number; maxAutoBid?: number | null }): number {
    return bid.maxAutoBid ?? bid.bidAmount;
  }

  /**
   * Claim a pending reward (winner receives item into inventory)
   */
  async claimReward(playerId: string, rewardId: string): Promise<void> {
    const reward = await this.prisma.auctionPendingReward.findUnique({
      where: { id: rewardId }
    });

    if (!reward) {
      throw new Error("Reward not found");
    }

    if (reward.playerId !== playerId) {
      throw new Error("This reward belongs to another player");
    }

    if (reward.expiresAt < new Date()) {
      throw new Error("This reward has expired");
    }

    // TODO: Add item to player's inventory (integrate with inventory system)
    // For now, just mark as claimed
    await this.prisma.auctionPendingReward.update({
      where: { id: rewardId },
      data: {
        claimed: true,
        claimedAt: new Date()
      }
    });
  }

  /**
   * Get all pending rewards for a player
   */
  async getPendingRewards(playerId: string) {
    return await this.prisma.auctionPendingReward.findMany({
      where: {
        playerId,
        claimedAt: null,
        claimed: false,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  /**
   * Process expired rewards (refund partial ducats if configured)
   */
  async processExpiredRewards(): Promise<number> {
    const expiredRewards = await this.prisma.auctionPendingReward.findMany({
      where: {
        claimedAt: null,
        claimed: false,
        expiresAt: { lte: new Date() }
      }
    });

    let processedCount = 0;

    for (const reward of expiredRewards) {
      // Refund percentage of bid (if configured)
      const refundAmount = Math.floor(
        (reward.winningBid * this.config.rewards.expiredRewardRefundPercentage) / 100
      );

      if (refundAmount > 0) {
        await this.prisma.currencyBalance.update({
          where: { playerId: reward.playerId },
          data: { ducats: { increment: refundAmount } }
        });
      }

      // Mark as expired
      await this.prisma.auctionPendingReward.update({
        where: { id: reward.id },
        data: {
          claimed: true,
          claimedAt: new Date()
        }
      });

      processedCount++;
    }

    return processedCount;
  }

  /**
   * Background job to periodically settle auctions
   * Run this on a cron schedule (e.g., every minute)
   */
  async runSettlementJob(): Promise<void> {
    try {
      const { settledCount, totalFeesCollected } = await this.settleAuctions();
      if (settledCount > 0) {
        console.log(`[Settlement] Settled ${settledCount} items, collected ${totalFeesCollected} ducats in fees`);
      }

      const expiredCount = await this.processExpiredRewards();
      if (expiredCount > 0) {
        console.log(`[Settlement] Processed ${expiredCount} expired rewards`);
      }
    } catch (error) {
      console.error("[Settlement] Error during settlement job:", error);
    }
  }
}
