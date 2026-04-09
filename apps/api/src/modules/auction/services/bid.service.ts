import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import { createSystemRewardMessage } from "../../messages/service.js";
import { buildAuctionOutbidMailboxMessage } from "./mailbox-message.service.js";
import { AuctionConfigService } from "./config.service.js";

type ActiveAuctionBidRecord = {
  id: string;
  itemId: string;
  playerId: string;
  bidAmount: number;
  status: string;
  isAutoBid: boolean;
  maxAutoBid: number | null;
  createdAt: Date;
};

type BidCandidate = {
  id: string | null;
  playerId: string;
  reserveAmount: number;
  createdAt: Date;
};

export class AuctionBidService {
  private configService = AuctionConfigService.getInstance();
  private config = this.configService.getConfig();

  constructor(
    private prisma: PrismaClient,
    private redis: Redis
  ) {}

  /**
   * Place or raise a proxy bid on an auction item.
   * The submitted amount becomes the bidder's reserved maximum.
   */
  async placeBid(
    playerId: string,
    itemId: string,
    bidAmount: number,
    _skipAutoBidTrigger: boolean = false
  ) {
    return this.prisma.$transaction(
      async (tx: any) => {
        const rateLimitKey = `bid:rate:${playerId}`;
        const bidCount = await this.redis.incr(rateLimitKey);
        await this.redis.expire(rateLimitKey, 60);
        if (bidCount > this.config.bidding.maxBidsPerMinute) {
          throw new Error(`Rate limit exceeded: max ${this.config.bidding.maxBidsPerMinute} bids per minute`);
        }

        const currency = await tx.currencyBalance.findUnique({
          where: { playerId },
          select: { ducats: true }
        });

        if (!currency) {
          throw new Error("Insufficient ducats");
        }

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

        const minimumAcceptedBid = this.calculateSubmittedBidFloor(item.currentBid, item.startingBid);
        if (bidAmount < minimumAcceptedBid) {
          throw new Error(`Bid must be at least ${minimumAcceptedBid} ducats`);
        }

        const activeBids = (await tx.auctionBid.findMany({
          where: {
            itemId,
            status: "active"
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            itemId: true,
            playerId: true,
            bidAmount: true,
            status: true,
            isAutoBid: true,
            maxAutoBid: true,
            createdAt: true
          }
        })) as ActiveAuctionBidRecord[];

        const activeBidByPlayer = new Map<string, ActiveAuctionBidRecord>();
        for (const bid of activeBids) {
          activeBidByPlayer.set(bid.playerId, bid);
        }

        const previousReservedByPlayer = new Map<string, number>();
        for (const bid of activeBids) {
          previousReservedByPlayer.set(
            bid.playerId,
            (previousReservedByPlayer.get(bid.playerId) ?? 0) + this.getReservedAmount(bid)
          );
        }

        const existingBid = activeBidByPlayer.get(playerId) ?? null;
        const existingReserveAmount = existingBid ? this.getReservedAmount(existingBid) : 0;
        const minimumAcceptedReserve = Math.max(minimumAcceptedBid, existingReserveAmount);
        if (bidAmount < minimumAcceptedReserve) {
          throw new Error(`Bid must be at least ${minimumAcceptedReserve} ducats`);
        }

        const submittedCandidate: BidCandidate = {
          id: existingBid?.id ?? null,
          playerId,
          reserveAmount: bidAmount,
          createdAt: existingBid?.createdAt ?? new Date()
        };

        const candidates: BidCandidate[] = [
          ...Array.from(activeBidByPlayer.values())
            .filter((bid) => bid.playerId !== playerId)
            .map((bid) => ({
              id: bid.id,
              playerId: bid.playerId,
              reserveAmount: this.getReservedAmount(bid),
              createdAt: bid.createdAt
            })),
          submittedCandidate
        ].sort((left, right) => this.compareBidCandidates(left, right));

        const newLeader = candidates[0];
        if (!newLeader) {
          throw new Error("Failed to resolve bid winner");
        }

        const runnerUp = candidates[1] ?? null;
        const previousLeader =
          (item.currentWinnerId ? activeBidByPlayer.get(item.currentWinnerId) ?? null : null) ??
          Array.from(activeBidByPlayer.values())
            .sort((left, right) =>
              this.compareBidCandidates(
                {
                  id: left.id,
                  playerId: left.playerId,
                  reserveAmount: this.getReservedAmount(left),
                  createdAt: left.createdAt
                },
                {
                  id: right.id,
                  playerId: right.playerId,
                  reserveAmount: this.getReservedAmount(right),
                  createdAt: right.createdAt
                }
              )
            )[0] ??
          null;

        const nextCurrentBid = this.determineNextCurrentBid({
          currentBid: item.currentBid,
          startingBid: item.startingBid,
          newLeader,
          runnerUp,
          previousLeader,
          submittedPlayerId: playerId,
          submittedReserve: bidAmount
        });

        const nextReservedByPlayer = new Map<string, number>([[newLeader.playerId, newLeader.reserveAmount]]);
        const bidderReserveDelta =
          (nextReservedByPlayer.get(playerId) ?? 0) - (previousReservedByPlayer.get(playerId) ?? 0);

        if (bidderReserveDelta > currency.ducats) {
          throw new Error("Insufficient ducats");
        }

        const affectedPlayers = new Set([
          ...previousReservedByPlayer.keys(),
          ...nextReservedByPlayer.keys()
        ]);

        for (const affectedPlayerId of affectedPlayers) {
          const previousReserved = previousReservedByPlayer.get(affectedPlayerId) ?? 0;
          const nextReserved = nextReservedByPlayer.get(affectedPlayerId) ?? 0;
          const balanceDelta = previousReserved - nextReserved;

          if (balanceDelta === 0) {
            continue;
          }

          if (balanceDelta < 0) {
            await tx.currencyBalance.update({
              where: { playerId: affectedPlayerId },
              data: {
                ducats: { decrement: Math.abs(balanceDelta) }
              }
            });
          }

          if (balanceDelta > 0 && affectedPlayerId !== newLeader.playerId) {
            const outbidBid = activeBidByPlayer.get(affectedPlayerId);
            if (!outbidBid) {
              continue;
            }

            const mailboxMessage = buildAuctionOutbidMailboxMessage({
              storedItemCode: item.itemCode,
              levelBracketMin: item.auctionInstance.levelBracketMin,
              levelBracketMax: item.auctionInstance.levelBracketMax,
              refundedDucats: balanceDelta
            });

            await createSystemRewardMessage(tx, {
              recipients: [affectedPlayerId],
              subject: mailboxMessage.subject,
              body: mailboxMessage.body,
              sourceType: "auction",
              sourceRefId: `auction-outbid:${outbidBid.id}`,
              rewards: {
                experience: 0,
                ducats: balanceDelta,
                imperials: 0,
                renown: 0,
                items: []
              }
            });
          }
        }

        const losingActiveBidIds = activeBids
          .filter((bid) => bid.playerId !== newLeader.playerId)
          .map((bid) => bid.id);

        if (losingActiveBidIds.length > 0) {
          await tx.auctionBid.updateMany({
            where: { id: { in: losingActiveBidIds } },
            data: { status: "outbid" }
          });
        }

        if (newLeader.playerId === playerId) {
          if (existingBid) {
            await tx.auctionBid.update({
              where: { id: existingBid.id },
              data: {
                bidAmount: nextCurrentBid,
                status: "active",
                isAutoBid: true,
                maxAutoBid: bidAmount
              }
            });
          } else {
            await tx.auctionBid.create({
              data: {
                itemId,
                playerId,
                bidAmount: nextCurrentBid,
                status: "active",
                isAutoBid: true,
                maxAutoBid: bidAmount
              }
            });
          }
        } else if (existingBid) {
          await tx.auctionBid.update({
            where: { id: existingBid.id },
            data: {
              bidAmount,
              status: "outbid",
              isAutoBid: true,
              maxAutoBid: bidAmount
            }
          });
        } else {
          await tx.auctionBid.create({
            data: {
              itemId,
              playerId,
              bidAmount,
              status: "outbid",
              isAutoBid: true,
              maxAutoBid: bidAmount
            }
          });
        }

        if (newLeader.playerId !== playerId) {
          const leaderBid = activeBidByPlayer.get(newLeader.playerId);
          if (!leaderBid) {
            throw new Error("Failed to resolve current leader bid");
          }

          await tx.auctionBid.update({
            where: { id: leaderBid.id },
            data: {
              bidAmount: nextCurrentBid,
              status: "active",
              isAutoBid: true,
              maxAutoBid: newLeader.reserveAmount
            }
          });
        }

        await tx.auctionItem.update({
          where: { id: itemId },
          data: {
            currentBid: nextCurrentBid,
            currentWinnerId: newLeader.playerId,
            bidCount: { increment: 1 }
          }
        });

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

        const updatedBalance = await tx.currencyBalance.findUnique({
          where: { playerId },
          select: { ducats: true }
        });

        return {
          remainingDucats: updatedBalance?.ducats ?? 0
        };
      },
      {
        isolationLevel: "Serializable"
      }
    );
  }

  /**
   * Enable proxy bidding with a reserved maximum amount.
   */
  async enableAutoBid(
    playerId: string,
    itemId: string,
    maxBid: number
  ) {
    const result = await this.placeBid(playerId, itemId, maxBid, true);
    return {
      success: true,
      remainingDucats: result.remainingDucats,
      maxBid
    };
  }

  /**
   * Disable proxy bidding and keep only the visible committed amount reserved.
   */
  async disableAutoBid(
    playerId: string,
    itemId: string
  ) {
    return this.prisma.$transaction(
      async (tx: any) => {
        const activeBid = await tx.auctionBid.findFirst({
          where: {
            itemId,
            playerId,
            status: "active"
          },
          orderBy: { createdAt: "desc" }
        });

        if (!activeBid) {
          throw new Error("No active auto-bid found");
        }

        const reservedAmount = this.getReservedAmount(activeBid);
        const refundAmount = Math.max(0, reservedAmount - activeBid.bidAmount);

        await tx.auctionBid.update({
          where: { id: activeBid.id },
          data: {
            isAutoBid: false,
            maxAutoBid: null
          }
        });

        if (refundAmount > 0) {
          await tx.currencyBalance.update({
            where: { playerId },
            data: { ducats: { increment: refundAmount } }
          });
        }

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
   * Proxy bidding is resolved inline in placeBid, so there is nothing left to trigger.
   */
  async triggerAutoBids(_itemId: string, _newBidderId: string) {
    return;
  }

  /**
   * Calculate minimum visible bid based on current bid and the item's configured starting bid.
   */
  calculateMinBid(currentBid: number, startingBid: number): number {
    return this.configService.calculateMinBid(currentBid, startingBid);
  }

  /**
   * Get bid history for an item (last N bids)
   */
  async getBidHistory(itemId: string, limit: number = 5) {
    return this.prisma.auctionBid.findMany({
      where: { itemId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        bidAmount: true,
        createdAt: true
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
    return this.prisma.auctionBid.findMany({
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

  private getReservedAmount(bid: { bidAmount: number; maxAutoBid?: number | null }): number {
    return bid.maxAutoBid ?? bid.bidAmount;
  }

  private calculateSubmittedBidFloor(currentBid: number, startingBid: number): number {
    return this.configService.calculateMinimumAcceptedBid(currentBid, startingBid);
  }

  private compareBidCandidates(left: BidCandidate, right: BidCandidate): number {
    if (left.reserveAmount !== right.reserveAmount) {
      return right.reserveAmount - left.reserveAmount;
    }

    if (left.createdAt.getTime() !== right.createdAt.getTime()) {
      return left.createdAt.getTime() - right.createdAt.getTime();
    }

    return (left.id ?? "").localeCompare(right.id ?? "");
  }

  private determineNextCurrentBid(args: {
    currentBid: number;
    startingBid: number;
    newLeader: BidCandidate;
    runnerUp: BidCandidate | null;
    previousLeader: ActiveAuctionBidRecord | null;
    submittedPlayerId: string;
    submittedReserve: number;
  }): number {
    const {
      currentBid,
      startingBid,
      newLeader,
      runnerUp,
      previousLeader
    } = args;

    if (runnerUp) {
      return Math.min(newLeader.reserveAmount, this.calculateMinBid(runnerUp.reserveAmount, startingBid));
    }

    if (previousLeader?.playerId === newLeader.playerId && currentBid > 0) {
      return currentBid;
    }

    return Math.min(newLeader.reserveAmount, this.calculateMinBid(0, startingBid));
  }
}
