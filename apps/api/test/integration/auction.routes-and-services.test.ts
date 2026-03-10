import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AuctionBidService } from "../../src/modules/auction/services/bid.service.js";
import { AuctionConfigService } from "../../src/modules/auction/services/config.service.js";
import { AuctionSettlementService } from "../../src/modules/auction/services/settlement.service.js";
import {
  authHeaders,
  createActiveAuction,
  createInventoryItemForPlayer,
  expireAuction,
  loginAsGuest,
  setPlayerDucats
} from "../helpers/fixtures.js";
import { createApiTestContext } from "../helpers/runtime.js";

describe("auction routes and services", () => {
  let context: Awaited<ReturnType<typeof createApiTestContext>>;

  beforeAll(async () => {
    context = await createApiTestContext();
  });

  beforeEach(async () => {
    await context.resetState();
  });

  afterAll(async () => {
    await context.close();
  });

  it("lists active auctions, accepts bids, and returns bid history", async () => {
    const bidder = await loginAsGuest(context.app, { guestId: "auction-bidder" });
    const { auction, item } = await createActiveAuction(context.prisma, {
      itemCode: JSON.stringify({ itemName: "Auction Blade" }),
      startingBid: 100
    });

    const activeResponse = await context.app.inject({
      method: "GET",
      url: "/v1/auction/active",
      headers: authHeaders(bidder.body.accessToken)
    });
    expect(activeResponse.statusCode).toBe(200);
    expect(activeResponse.json().auctions[0].id).toBe(auction.id);

    const bidResponse = await context.app.inject({
      method: "POST",
      url: "/v1/auction/bid",
      headers: authHeaders(bidder.body.accessToken),
      payload: {
        itemId: item.id,
        bidAmount: 100
      }
    });
    expect(bidResponse.statusCode).toBe(200);

    const detailResponse = await context.app.inject({
      method: "GET",
      url: `/v1/auction/${auction.id}`,
      headers: authHeaders(bidder.body.accessToken)
    });
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json().auction.items[0].myBid.bidAmount).toBe(100);

    const historyResponse = await context.app.inject({
      method: "GET",
      url: `/v1/auction/item/${item.id}/bids`,
      headers: authHeaders(bidder.body.accessToken)
    });
    expect(historyResponse.statusCode).toBe(200);
    expect(historyResponse.json().bids[0].bidAmount).toBe(100);
  });

  it("handles auto-bid escalation, refund correctness, and rate limiting", async () => {
    const firstBidder = await loginAsGuest(context.app, { guestId: "auto-bid-1" });
    const secondBidder = await loginAsGuest(context.app, { guestId: "auto-bid-2" });
    const { item } = await createActiveAuction(context.prisma, {
      itemCode: JSON.stringify({ itemName: "Auto Bid Relic" }),
      startingBid: 100
    });
    await setPlayerDucats(context.prisma, firstBidder.body.playerId, 10_000);
    await setPlayerDucats(context.prisma, secondBidder.body.playerId, 10_000);

    const enableResponse = await context.app.inject({
      method: "POST",
      url: "/v1/auction/autobid/enable",
      headers: authHeaders(firstBidder.body.accessToken),
      payload: {
        itemId: item.id,
        maxBid: 200
      }
    });
    expect(enableResponse.statusCode).toBe(200);

    const bidService = new AuctionBidService(context.prisma, context.redis);
    await bidService.placeBid(secondBidder.body.playerId, item.id, 110, true);
    await bidService.triggerAutoBids(item.id, secondBidder.body.playerId);

    const refreshedItem = await context.prisma.auctionItem.findUniqueOrThrow({
      where: { id: item.id }
    });
    expect(refreshedItem.currentWinnerId).toBe(firstBidder.body.playerId);
    expect(refreshedItem.currentBid).toBe(120);

    const secondBidderBalance = await context.prisma.currencyBalance.findUniqueOrThrow({
      where: { playerId: secondBidder.body.playerId }
    });
    expect(secondBidderBalance.ducats).toBe(10_000);

    const maxBidsPerMinute = AuctionConfigService.getInstance().getConfig().bidding.maxBidsPerMinute;
    await context.redis.set(`bid:rate:${firstBidder.body.playerId}`, String(maxBidsPerMinute), "EX", 60);

    await expect(bidService.placeBid(firstBidder.body.playerId, item.id, 130)).rejects.toThrow(/Rate limit exceeded/);
  });

  it("settles auctions idempotently and lets winners claim pending rewards", async () => {
    const winner = await loginAsGuest(context.app, { guestId: "auction-winner" });
    const seller = await loginAsGuest(context.app, { guestId: "auction-seller" });
    const rewardItem = await createInventoryItemForPlayer(context.prisma, winner.body.playerId, {
      itemName: "Pending Reward Sword"
    });

    const { auction, item } = await createActiveAuction(context.prisma, {
      itemCode: JSON.stringify(rewardItem),
      currentBid: 250,
      currentWinnerId: winner.body.playerId,
      sellerId: seller.body.playerId,
      isPlayerSubmitted: true,
      feePercentage: 10
    });

    await expireAuction(context.prisma, auction.id);

    const settlementService = new AuctionSettlementService(context.prisma);
    const firstSettlement = await settlementService.settleAuctions();
    const secondSettlement = await settlementService.settleAuctions();

    expect(firstSettlement.settledCount).toBe(1);
    expect(secondSettlement.settledCount).toBe(0);

    const pendingRewards = await context.prisma.auctionPendingReward.findMany({
      where: {
        playerId: winner.body.playerId
      }
    });
    expect(pendingRewards).toHaveLength(1);

    const pendingRewardsResponse = await context.app.inject({
      method: "GET",
      url: "/v1/auction/rewards/pending",
      headers: authHeaders(winner.body.accessToken)
    });
    expect(pendingRewardsResponse.statusCode).toBe(200);
    expect(pendingRewardsResponse.json().rewards).toHaveLength(1);

    const sellerBalance = await context.prisma.currencyBalance.findUniqueOrThrow({
      where: { playerId: seller.body.playerId }
    });
    expect(sellerBalance.ducats).toBeGreaterThan(100_000);

    const claimResponse = await context.app.inject({
      method: "POST",
      url: "/v1/auction/rewards/claim",
      headers: authHeaders(winner.body.accessToken),
      payload: {
        rewardId: pendingRewards[0].id
      }
    });
    expect(claimResponse.statusCode).toBe(200);

    await expect
      .poll(async () => {
        const claimedReward = await context.prisma.auctionPendingReward.findUniqueOrThrow({
          where: { id: pendingRewards[0].id }
        });
        return claimedReward.claimed;
      })
      .toBe(true);

    await expect
      .poll(async () =>
        context.prisma.inventoryItem.count({
          where: {
            playerId: winner.body.playerId,
            itemCode: rewardItem.itemCode
          }
        })
      )
      .toBeGreaterThan(0);
  });
});
