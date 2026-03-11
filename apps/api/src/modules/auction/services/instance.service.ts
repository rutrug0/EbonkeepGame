import type { PrismaClient } from "@prisma/client";
import { AuctionItemGeneratorService } from "./item-generator.service.js";
import { AuctionConfigService } from "./config.service.js";
import { PlayerSubmissionService } from "./player-submission.service.js";
import { parseAuctionStoredItem } from "./item-payload.service.js";

export class AuctionInstanceService {
  private itemGenerator: AuctionItemGeneratorService;
  private submissionService: PlayerSubmissionService;
  private configService = AuctionConfigService.getInstance();
  private config = this.configService.getConfig();

  constructor(private prisma: PrismaClient) {
    this.itemGenerator = new AuctionItemGeneratorService();
    this.submissionService = new PlayerSubmissionService(prisma);
  }

  /**
   * Create new auction instances for all level brackets
   * Called by cron at configured start times
   */
  async createAuctionInstances(options?: {
    systemItemScope?: "all" | "warriorHeavyAndMelee";
  }): Promise<void> {
    const levelBrackets = this.configService.getLevelBrackets();

    const now = new Date();
    const auctionCountPerBracket = Math.max(1, this.config.instance.concurrentAuctionsPerBracket);
    const staggerHours = this.config.instance.auctionDurationHours / auctionCountPerBracket;
    const staggerMs = staggerHours * 60 * 60 * 1000;

    for (const bracket of levelBrackets) {
      const { min, max } = bracket;
      const activeAuctionCount = await this.prisma.auctionInstance.count({
        where: {
          levelBracketMin: min,
          levelBracketMax: max,
          status: "active",
          endTime: {
            gt: now
          }
        }
      });
      const missingAuctionCount = Math.max(0, auctionCountPerBracket - activeAuctionCount);

      for (let index = 0; index < missingAuctionCount; index += 1) {
        const startTime = new Date(now.getTime() - index * staggerMs);
        const endTime = this.configService.calculateAuctionEndTime(startTime);
        const totalItems = this.config.instance.itemsPerAuction;
        const systemItemCount = Math.ceil(
          (totalItems * this.config.items.systemGeneratedPercentage) / 100
        );
        const playerItemCount = totalItems - systemItemCount;

        const systemItems = await this.itemGenerator.generateItemsForAuction(
          min,
          max,
          systemItemCount,
          {
            templateScope: options?.systemItemScope ?? "all"
          }
        );

        const playerListings = await this.submissionService.getApprovedListingsForAuction(
          Math.floor((min + max) / 2),
          playerItemCount
        );

        const auction = await this.prisma.auctionInstance.create({
          data: {
            levelBracketMin: min,
            levelBracketMax: max,
            startTime,
            endTime,
            status: "active",
            items: {
              create: [
                ...systemItems.map((item) => ({
                  itemCode: JSON.stringify(item.itemData),
                  itemLevel: item.itemLevel,
                  itemRarity: item.itemRarity,
                  itemCategory: item.itemCategory,
                  startingBid: item.startingBid,
                  currentBid: 0,
                  bidCount: 0,
                  extensionsUsed: 0,
                  isPlayerSubmitted: false,
                  sellerId: null,
                  feePercentage: this.config.fees.systemItemFeePercentage
                })),
                ...playerListings.map((listing) => ({
                  itemCode: JSON.stringify(listing.itemData),
                  itemLevel: listing.itemLevel,
                  itemRarity: listing.itemRarity,
                  itemCategory: listing.itemCategory,
                  startingBid: listing.startingBid,
                  currentBid: 0,
                  bidCount: 0,
                  extensionsUsed: 0,
                  isPlayerSubmitted: true,
                  sellerId: listing.sellerId,
                  feePercentage: this.config.fees.playerItemFeePercentage
                }))
              ]
            }
          }
        });

        if (playerListings.length > 0) {
          await this.submissionService.markListingsAsAdded(
            playerListings.map((listing) => listing.id),
            auction.id
          );
        }

        console.log(
          `Created auction ${activeAuctionCount + index + 1}/${auctionCountPerBracket} for bracket [${min}-${max}] with ${systemItemCount} system + ${playerListings.length} player items (${Math.round((endTime.getTime() - now.getTime()) / (60 * 60 * 1000))}h remaining)`
        );
      }
    }
  }

  async rerollActiveAuctions(): Promise<{
    deletedAuctionCount: number;
    refundedBidCount: number;
    refundedDucats: number;
  }> {
    const activeAuctions = await this.prisma.auctionInstance.findMany({
      where: { status: "active" },
      include: {
        items: {
          select: {
            id: true
          }
        }
      }
    });

    const activeAuctionIds = activeAuctions.map((auction) => auction.id);
    const activeAuctionItemIds = activeAuctions.flatMap((auction) => auction.items.map((item) => item.id));

    const activeBids: Array<{ playerId: string; bidAmount: number; maxAutoBid?: number | null }> = activeAuctionItemIds.length
      ? (await this.prisma.auctionBid.findMany({
          where: {
            itemId: { in: activeAuctionItemIds },
            status: "active"
          },
          select: {
            playerId: true,
            bidAmount: true,
            maxAutoBid: true
          }
        })) as Array<{ playerId: string; bidAmount: number; maxAutoBid?: number | null }>
      : [];

    const refundedByPlayer = new Map<string, number>();
    for (const bid of activeBids) {
      const reservedAmount = bid.maxAutoBid ?? bid.bidAmount;
      refundedByPlayer.set(bid.playerId, (refundedByPlayer.get(bid.playerId) ?? 0) + reservedAmount);
    }

    await this.prisma.$transaction(async (tx) => {
      for (const [playerId, amount] of refundedByPlayer) {
        if (amount <= 0) {
          continue;
        }

        await tx.currencyBalance.update({
          where: { playerId },
          data: {
            ducats: {
              increment: amount
            }
          }
        });
      }

      if (activeAuctionIds.length > 0 || activeAuctionItemIds.length > 0) {
        await tx.auctionPlayerListing.updateMany({
          where: {
            status: "listed",
            OR: [
              {
                auctionItemId: { in: activeAuctionIds.length > 0 ? activeAuctionIds : ["__none__"] }
              },
              {
                auctionItemId: { in: activeAuctionItemIds.length > 0 ? activeAuctionItemIds : ["__none__"] }
              }
            ]
          },
          data: {
            status: "approved",
            auctionItemId: null,
            listedAt: null
          }
        });
      }

      if (activeAuctionIds.length > 0) {
        await tx.auctionInstance.deleteMany({
          where: {
            id: { in: activeAuctionIds }
          }
        });
      }
    });

    await this.createAuctionInstances({
      systemItemScope: "warriorHeavyAndMelee"
    });

    return {
      deletedAuctionCount: activeAuctionIds.length,
      refundedBidCount: activeBids.length,
      refundedDucats: Array.from(refundedByPlayer.values()).reduce((sum, amount) => sum + amount, 0)
    };
  }

  /**
   * Get active auctions for a player's level bracket
   */
  async getActiveAuctionsForPlayer(playerId: string) {
    const player = await this.prisma.playerProfile.findUnique({
      where: { id: playerId },
      select: { level: true }
    });

    if (!player) {
      throw new Error("Player not found");
    }

    const bracket = this.getLevelBracket(player.level);
    const now = new Date();
    const auctions = await this.prisma.auctionInstance.findMany({
      where: {
        levelBracketMin: bracket.min,
        levelBracketMax: bracket.max,
        status: "active",
        endTime: {
          gt: now
        }
      },
      include: {
        items: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            itemCode: true,
            itemLevel: true,
            itemRarity: true,
            itemCategory: true,
            startingBid: true,
            currentBid: true,
            currentWinnerId: true,
            bidCount: true,
            extensionsUsed: true,
            isPlayerSubmitted: true
          }
        }
      },
      orderBy: {
        startTime: "desc"
      },
      take: 3
    });

    const winnerIds = Array.from(
      new Set(
        auctions.flatMap((auction) =>
          auction.items
            .map((item) => item.currentWinnerId)
            .filter((winnerId): winnerId is string => Boolean(winnerId))
        )
      )
    );

    const winnerProfiles = winnerIds.length
      ? await this.prisma.playerProfile.findMany({
          where: { id: { in: winnerIds } },
          select: {
            id: true,
            account: {
              select: {
                username: true
              }
            }
          }
        })
      : [];

    const winnerNameById = new Map(
      winnerProfiles.map((profile) => [
        profile.id,
        profile.account.username || `Player ${profile.id.slice(-6).toUpperCase()}`
      ])
    );

    return auctions.map((auction) => ({
      ...auction,
      items: auction.items.map((item) => ({
        ...item,
        currentWinnerName: item.currentWinnerId ? winnerNameById.get(item.currentWinnerId) ?? null : null,
        itemData: parseAuctionStoredItem(item.itemCode).viewData,
        minimumNextBid: this.configService.calculateMinimumAcceptedBid(item.currentBid, item.startingBid),
        amIWinning: item.currentWinnerId === playerId
      }))
    }));
  }

  /**
   * Get detailed view of a specific auction
   */
  async getAuctionDetails(auctionId: string, playerId: string) {
    const auction = await this.prisma.auctionInstance.findUnique({
      where: { id: auctionId },
      include: {
        items: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          include: {
            bids: {
              where: { playerId },
              orderBy: { createdAt: "desc" },
              take: 1
            }
          }
        }
      }
    });

    if (!auction) {
      throw new Error("Auction not found");
    }

    const itemsWithStatus = auction.items.map((item: any) => ({
      ...item,
      minimumNextBid: this.configService.calculateMinimumAcceptedBid(item.currentBid, item.startingBid),
      myBid: item.bids[0] || null,
      amIWinning: item.currentWinnerId === playerId,
      amIOutbid:
        item.bids.length > 0 && item.currentWinnerId !== playerId && item.bids[0].status === "outbid"
    }));

    return {
      ...auction,
      items: itemsWithStatus
    };
  }

  /**
   * Check if auction is active and can accept bids
   */
  async isAuctionActive(auctionId: string): Promise<boolean> {
    const auction = await this.prisma.auctionInstance.findUnique({
      where: { id: auctionId },
      select: { status: true, endTime: true }
    });

    if (!auction) {
      return false;
    }

    return auction.status === "active" && auction.endTime > new Date();
  }

  /**
   * Get time remaining for auction in milliseconds
   */
  async getTimeRemaining(auctionId: string): Promise<number> {
    const auction = await this.prisma.auctionInstance.findUnique({
      where: { id: auctionId },
      select: { endTime: true }
    });

    if (!auction) {
      return 0;
    }

    return Math.max(0, auction.endTime.getTime() - Date.now());
  }

  /**
   * Determine level bracket for a player level
   */
  private getLevelBracket(level: number): { min: number; max: number } {
    const brackets = this.configService.getLevelBrackets();
    return brackets.find((entry) => level >= entry.min && level <= entry.max) || brackets[0];
  }

  /**
   * Get player's auction activity summary
   */
  async getPlayerActivity(playerId: string) {
    const [activeBids, wonItems, pendingRewards] = await Promise.all([
      this.prisma.auctionBid.count({
        where: { playerId, status: "active" }
      }),
      this.prisma.auctionBid.count({
        where: { playerId, status: "won" }
      }),
      this.prisma.auctionPendingReward.count({
        where: { playerId, claimed: false }
      })
    ]);

    return {
      activeBids,
      wonItems,
      pendingRewards
    };
  }
}
