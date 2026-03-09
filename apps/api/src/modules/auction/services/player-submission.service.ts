import type { PrismaClient } from "@prisma/client";
import { AuctionConfigService } from "./config.service.js";

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
    // 1. Validate player level
    const player = await this.prisma.playerProfile.findUnique({
      where: { id: playerId },
      select: { level: true }
    });

    if (!player || player.level < this.config.economy.minPlayerLevelSubmit) {
      throw new Error(
        `Player must be level ${this.config.economy.minPlayerLevelSubmit} or higher to submit items`
      );
    }

    // 2. Check active submission limit
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

    // 3. Calculate and check listing fee (5% of starting bid)
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

    // 4. Deduct listing fee upfront
    await this.prisma.currencyBalance.update({
      where: { playerId },
      data: { ducats: { decrement: listingFee } }
    });

    // 5. Remove item from player's inventory
    const inventoryItemId = itemData.inventoryItemId;
    if (inventoryItemId) {
      try {
        await this.prisma.inventoryItem.delete({
          where: { id: inventoryItemId }
        });
      } catch (error) {
        // Refund listing fee if inventory removal fails
        await this.prisma.currencyBalance.update({
          where: { playerId },
          data: { ducats: { increment: listingFee } }
        });
        throw new Error("Failed to remove item from inventory");
      }
    }

    // 6. Create approved listing (no moderation needed)
    const listing = await this.prisma.auctionPlayerListing.create({
      data: {
        playerId,
        inventoryItemId: inventoryItemId || `temp_${Date.now()}`,
        itemCode: JSON.stringify(itemData),
        itemLevel: itemData.level || 1,
        itemRarity: itemData.rarity || "common",
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

    // Refund listing fee if applicable
    if (refundListingFee && this.config.fees.listingFeeEnabled) {
      await this.prisma.currencyBalance.update({
        where: { playerId: listing.playerId },
        data: { ducats: { increment: this.config.fees.listingFeeDucats } }
      });
    }

    // TODO: Return item to player's inventory

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
  ): Promise<Array<{ id: string; itemData: any; startingBid: number; sellerId: string }>> {
    // Find appropriate level bracket
    const brackets = AuctionConfigService.getInstance().getLevelBrackets();
    const bracket = brackets.find((b) => playerLevel >= b.min && playerLevel <= b.max);

    if (!bracket) {
      return [];
    }

    // Get approved listings that haven't been listed yet
    const listings = await this.prisma.auctionPlayerListing.findMany({
      where: {
        status: "approved",
        auctionItemId: null
      },
      orderBy: { approvedAt: "asc" },
      take: count
    });

    return listings.map((listing: any) => ({
      id: listing.id,
      itemData: JSON.parse(listing.itemCode),
      startingBid: listing.minimumBid,
      sellerId: listing.playerId
    }));
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

    // Can cancel pending items (not yet reviewed)
    if (listing.status === "pending") {
      // Refund listing fee for pending cancellations (5% of starting bid)
      const listingFee = Math.ceil((listing.minimumBid * this.config.fees.playerItemFeePercentage) / 100);
      
      await this.prisma.currencyBalance.update({
        where: { playerId },
        data: { ducats: { increment: listingFee } }
      });

      // Return item to player's inventory
      const itemData = JSON.parse(listing.itemCode);
      await this.prisma.inventoryItem.create({
        data: {
          playerId: playerId,
          slotKey: itemData.category || "misc",
          itemCode: listing.itemCode,
          quantity: 1
        }
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

    // Can cancel approved items (not yet in auction)
    if (listing.status === "approved") {
      // NOTE: Listing fee is NOT refunded - it's a service fee
      
      // Return item to player's inventory
      const itemData = JSON.parse(listing.itemCode);
      await this.prisma.inventoryItem.create({
        data: {
          playerId: playerId,
          slotKey: itemData.category || "misc",
          itemCode: listing.itemCode,
          quantity: 1
        }
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

    // Can cancel listed items ONLY if they have no bids
    if (listing.status === "listed" && listing.auctionItemId) {
      // Check if the auction item has any bids
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

      // No bids, can cancel - NOTE: Listing fee is NOT refunded
      
      // Return item to player's inventory
      const itemData = JSON.parse(listing.itemCode);
      await this.prisma.inventoryItem.create({
        data: {
          playerId: playerId,
          slotKey: itemData.category || "misc",
          itemCode: listing.itemCode,
          quantity: 1
        }
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
}
