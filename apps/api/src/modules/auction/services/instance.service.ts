import type { PrismaClient } from "@prisma/client";
import { AuctionItemGeneratorService } from "./item-generator.service.js";
import { AuctionConfigService } from "./config.service.js";
import { PlayerSubmissionService } from "./player-submission.service.js";

export class AuctionInstanceService {
  private itemGenerator: AuctionItemGeneratorService;
  private submissionService: PlayerSubmissionService;
  private config = AuctionConfigService.getInstance().getConfig();

  constructor(private prisma: PrismaClient) {
    this.itemGenerator = new AuctionItemGeneratorService();
    this.submissionService = new PlayerSubmissionService(prisma);
  }

  /**
   * Create new auction instances for all level brackets
   * Called by cron at configured start times
   */
  async createAuctionInstances(): Promise<void> {
    const levelBrackets = AuctionConfigService.getInstance().getLevelBrackets();

    const now = new Date();
    const endTime = AuctionConfigService.getInstance().calculateAuctionEndTime(now);

    for (const bracket of levelBrackets) {
      const { min, max } = bracket;

      // Calculate how many items to generate (system vs player)
      const totalItems = this.config.instance.itemsPerAuction;
      const systemItemCount = Math.ceil(
        (totalItems * this.config.items.systemGeneratedPercentage) / 100
      );
      const playerItemCount = totalItems - systemItemCount;

      // Generate system items
      const systemItems = await this.itemGenerator.generateItemsForAuction(
        min,
        max,
        systemItemCount
      );

      // Get approved player submissions for this bracket
      const playerListings = await this.submissionService.getApprovedListingsForAuction(
        Math.floor((min + max) / 2), // Use mid-point of bracket
        playerItemCount
      );

      // Create auction instance with mixed items
      const auction = await this.prisma.auctionInstance.create({
        data: {
          levelBracketMin: min,
          levelBracketMax: max,
          startTime: now,
          endTime: endTime,
          status: "active",
          items: {
            create: [
              // System-generated items
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
              // Player-submitted items
              ...playerListings.map((listing) => ({
                itemCode: JSON.stringify(listing.itemData),
                itemLevel: Math.floor((min + max) / 2), // Approximate level
                itemRarity: "uncommon", // Extract from itemData if available
                itemCategory: "weapon", // Extract from itemData if available
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

      // Mark player listings as added to auction
      if (playerListings.length > 0) {
        await this.submissionService.markListingsAsAdded(
          playerListings.map((l) => l.id),
          auction.id
        );
      }

      console.log(
        `Created auction for bracket [${min}-${max}] with ${systemItemCount} system + ${playerListings.length} player items`
      );
    }
  }

  /**
   * Get active auctions for a player's level bracket
   */
  async getActiveAuctionsForPlayer(playerId: string) {
    // Get player level
    const player = await this.prisma.playerProfile.findUnique({
      where: { id: playerId },
      select: { level: true }
    });

    if (!player) {
      throw new Error("Player not found");
    }

    // Determine level bracket
    const bracket = this.getLevelBracket(player.level);

    // Find active auctions in this bracket
    return await this.prisma.auctionInstance.findMany({
      where: {
        levelBracketMin: bracket.min,
        levelBracketMax: bracket.max,
        status: "active"
      },
      include: {
        items: {
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
            extensionsUsed: true
          }
        }
      },
      orderBy: {
        startTime: "asc" // Oldest first (will end soonest)
      },
      take: 3 // Return max 3 active auctions
    });
  }

  /**
   * Get detailed view of a specific auction
   */
  async getAuctionDetails(auctionId: string, playerId: string) {
    const auction = await this.prisma.auctionInstance.findUnique({
      where: { id: auctionId },
      include: {
        items: {
          include: {
            bids: {
              where: { playerId },
              orderBy: { createdAt: "desc" },
              take: 1 // Get player's most recent bid (if any)
            }
          }
        }
      }
    });

    if (!auction) {
      throw new Error("Auction not found");
    }

    // Transform items to include player's bid status
    const itemsWithStatus = auction.items.map((item: any) => ({
      ...item,
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
    const brackets = AuctionConfigService.getInstance().getLevelBrackets();
    return brackets.find((b) => level >= b.min && level <= b.max) || brackets[0];
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
