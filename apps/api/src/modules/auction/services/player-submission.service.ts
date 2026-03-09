import type { PrismaClient } from "@prisma/client";
import { AuctionConfigService } from "./config.service.js";
import {
  buildInventoryItemRecordFromAuctionPayload,
  parseAuctionStoredItem
} from "./item-payload.service.js";

export class PlayerSubmissionService {
  private config = AuctionConfigService.getInstance().getConfig();

  constructor(private prisma: PrismaClient) {}

  /**
   * Submit an item from player's inventory to the auction house
   * Auto-approved if player hasn't exceeded submission limit
   */
  async submitItem(
    playerId: string,
    itemData: any,
    desiredStartingBid: number
  ): Promise<string> {
    const player = await this.prisma.playerProfile.findUnique({
      where: { id: playerId },
      select: { level: true }
    });

    if (!player || player.level < this.config.economy.minPlayerLevelSubmit) {
      throw new Error(
        `Player must be level ${this.config.economy.minPlayerLevelSubmit} or higher to submit items`
      );
    }

    const activeCount = await this.prisma.auctionPlayerListing.count({
      where: {
        playerId,
        status: { in: ["approved", "listed"] }
      }
    });

    if (activeCount >= this.config.economy.maxPlayerActiveSubmissions) {
      throw new Error(
        `You can only have ${this.config.economy.maxPlayerActiveSubmissions} items in auction at a time. Wait for current auctions to end or cancel a submission.`
      );
    }

    const listingFee = Math.ceil((desiredStartingBid * this.config.fees.playerItemFeePercentage) / 100);
    const currency = await this.prisma.currencyBalance.findUnique({
      where: { playerId },
      select: { ducats: true }
    });

    if (!currency || currency.ducats < listingFee) {
      throw new Error(
        `Insufficient ducats for listing fee. You need ${listingFee} ducats (${this.config.fees.playerItemFeePercentage}% of starting bid).`
      );
    }

    await this.prisma.currencyBalance.update({
      where: { playerId },
      data: { ducats: { decrement: listingFee } }
    });

    const normalizedItem = this.normalizeSubmissionItemData(itemData);
    if (normalizedItem.inventoryItemId) {
      try {
        await this.prisma.inventoryItem.delete({
          where: { id: normalizedItem.inventoryItemId }
        });
      } catch {
        await this.prisma.currencyBalance.update({
          where: { playerId },
          data: { ducats: { increment: listingFee } }
        });
        throw new Error("Failed to remove item from inventory");
      }
    }

    const listing = await this.prisma.auctionPlayerListing.create({
      data: {
        playerId,
        inventoryItemId: normalizedItem.inventoryItemId || `temp_${Date.now()}`,
        itemCode: JSON.stringify(normalizedItem.storedItemData),
        itemLevel: normalizedItem.itemLevel,
        itemRarity: normalizedItem.itemRarity,
        minimumBid: desiredStartingBid,
        status: "approved",
        approvedAt: new Date()
      }
    });

    return listing.id;
  }

  /**
   * Get all pending submissions (for admin/moderator approval)
   */
  async getPendingSubmissions(limit: number = 50) {
    return await this.prisma.auctionPlayerListing.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      take: limit
    });
  }

  /**
   * Approve a player submission (admin/moderator action)
   */
  async approveSubmission(listingId: string, adminId: string): Promise<void> {
    const listing = await this.prisma.auctionPlayerListing.findUnique({
      where: { id: listingId }
    });

    if (!listing) {
      throw new Error("Listing not found");
    }

    if (listing.status !== "pending") {
      throw new Error("Listing is not pending approval");
    }

    await this.prisma.auctionPlayerListing.update({
      where: { id: listingId },
      data: {
        status: "approved",
        approvedBy: adminId,
        approvedAt: new Date()
      }
    });
  }

  /**
   * Reject a player submission (admin/moderator action)
   * Optionally refund listing fee if enabled
   */
  async rejectSubmission(
    listingId: string,
    adminId: string,
    reason: string,
    refundListingFee: boolean = true
  ): Promise<void> {
    const listing = await this.prisma.auctionPlayerListing.findUnique({
      where: { id: listingId }
    });

    if (!listing) {
      throw new Error("Listing not found");
    }

    if (listing.status !== "pending") {
      throw new Error("Listing is not pending approval");
    }

    if (refundListingFee && this.config.fees.listingFeeEnabled) {
      await this.prisma.currencyBalance.update({
        where: { playerId: listing.playerId },
        data: { ducats: { increment: this.config.fees.listingFeeDucats } }
      });
    }

    await this.prisma.auctionPlayerListing.update({
      where: { id: listingId },
      data: {
        status: "rejected",
        rejectedBy: adminId,
        rejectedAt: new Date(),
        rejectionReason: reason
      }
    });
  }

  /**
   * Queue approved listings for the next auction
   * Called during auction creation to include player items
   */
  async getApprovedListingsForAuction(
    playerLevel: number,
    count: number
  ): Promise<Array<{ id: string; itemData: any; itemLevel: number; itemRarity: string; itemCategory: string; startingBid: number; sellerId: string }>> {
    const brackets = AuctionConfigService.getInstance().getLevelBrackets();
    const bracket = brackets.find((entry) => playerLevel >= entry.min && playerLevel <= entry.max);

    if (!bracket) {
      return [];
    }

    const listings = await this.prisma.auctionPlayerListing.findMany({
      where: {
        status: "approved",
        auctionItemId: null
      },
      orderBy: { approvedAt: "asc" },
      take: count
    });

    return listings.map((listing: any) => {
      const parsedItem = parseAuctionStoredItem(listing.itemCode);
      return {
        id: listing.id,
        itemData: parsedItem.inventoryItem ?? parsedItem.viewData,
        itemLevel: listing.itemLevel || parsedItem.viewData.levelRequirement,
        itemRarity: listing.itemRarity || parsedItem.viewData.rarity,
        itemCategory: parsedItem.viewData.category,
        startingBid: listing.minimumBid,
        sellerId: listing.playerId
      };
    });
  }

  /**
   * Mark listings as added to an auction
   */
  async markListingsAsAdded(listingIds: string[], auctionInstanceId: string): Promise<void> {
    await this.prisma.auctionPlayerListing.updateMany({
      where: { id: { in: listingIds } },
      data: {
        status: "listed",
        auctionItemId: auctionInstanceId,
        listedAt: new Date()
      }
    });
  }

  /**
   * Get player's submission history
   */
  async getPlayerSubmissions(playerId: string) {
    return await this.prisma.auctionPlayerListing.findMany({
      where: { playerId },
      orderBy: { createdAt: "desc" }
    });
  }

  /**
   * Cancel a submission (player action)
   * Can cancel if:
   * - Status is "approved" (not yet in auction)
   * - Status is "listed" but item has no bids
   */
  async cancelSubmission(playerId: string, listingId: string): Promise<void> {
    const listing = await this.prisma.auctionPlayerListing.findUnique({
      where: { id: listingId }
    });

    if (!listing) {
      throw new Error("Listing not found");
    }

    if (listing.playerId !== playerId) {
      throw new Error("This listing belongs to another player");
    }

    if (listing.status === "pending") {
      const listingFee = Math.ceil((listing.minimumBid * this.config.fees.playerItemFeePercentage) / 100);

      await this.prisma.currencyBalance.update({
        where: { playerId },
        data: { ducats: { increment: listingFee } }
      });

      await this.prisma.inventoryItem.create({
        data: buildInventoryItemRecordFromAuctionPayload({
          playerId,
          storedItemCode: listing.itemCode
        })
      });

      await this.prisma.auctionPlayerListing.update({
        where: { id: listingId },
        data: {
          status: "cancelled",
          rejectedAt: new Date(),
          rejectionReason: "Cancelled by player"
        }
      });
      return;
    }

    if (listing.status === "approved") {
      await this.prisma.inventoryItem.create({
        data: buildInventoryItemRecordFromAuctionPayload({
          playerId,
          storedItemCode: listing.itemCode
        })
      });

      await this.prisma.auctionPlayerListing.update({
        where: { id: listingId },
        data: {
          status: "cancelled",
          rejectedAt: new Date(),
          rejectionReason: "Cancelled by player"
        }
      });
      return;
    }

    if (listing.status === "listed" && listing.auctionItemId) {
      const auctionItem = await this.prisma.auctionItem.findUnique({
        where: { id: listing.auctionItemId },
        select: { bidCount: true }
      });

      if (!auctionItem) {
        throw new Error("Auction item not found");
      }

      if (auctionItem.bidCount > 0) {
        throw new Error("Cannot cancel item with active bids");
      }

      await this.prisma.inventoryItem.create({
        data: buildInventoryItemRecordFromAuctionPayload({
          playerId,
          storedItemCode: listing.itemCode
        })
      });

      await this.prisma.auctionPlayerListing.update({
        where: { id: listingId },
        data: {
          status: "cancelled",
          rejectedAt: new Date(),
          rejectionReason: "Cancelled by player"
        }
      });
      return;
    }

    throw new Error("Cannot cancel this submission");
  }

  private normalizeSubmissionItemData(itemData: any): {
    inventoryItemId?: string;
    storedItemData: unknown;
    itemLevel: number;
    itemRarity: string;
    itemCategory: string;
  } {
    const inventoryItemId = typeof itemData?.inventoryItemId === "string" ? itemData.inventoryItemId : undefined;
    const parsedItem = parseAuctionStoredItem(JSON.stringify(itemData));

    return {
      inventoryItemId,
      storedItemData: parsedItem.inventoryItem ?? parsedItem.viewData,
      itemLevel: parsedItem.viewData.levelRequirement,
      itemRarity: parsedItem.viewData.rarity,
      itemCategory: parsedItem.viewData.category
    };
  }
}
