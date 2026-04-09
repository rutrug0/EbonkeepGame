import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AuctionBidService } from "../../src/modules/auction/services/bid.service.js";
import { AuctionConfigService } from "../../src/modules/auction/services/config.service.js";
import { AuctionInstanceService } from "../../src/modules/auction/services/instance.service.js";
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
        bidAmount: 111
      }
    });
    expect(bidResponse.statusCode).toBe(200);

    const detailResponse = await context.app.inject({
      method: "GET",
      url: `/v1/auction/${auction.id}`,
      headers: authHeaders(bidder.body.accessToken)
    });
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json().auction.items[0].myBid.bidAmount).toBe(110);

    const historyResponse = await context.app.inject({
      method: "GET",
      url: `/v1/auction/item/${item.id}/bids`,
      headers: authHeaders(bidder.body.accessToken)
    });
    expect(historyResponse.statusCode).toBe(200);
    expect(historyResponse.json().bids[0].bidAmount).toBe(110);
  });

  it("publishes the enforced bid floor in auction responses", async () => {
    const incumbent = await loginAsGuest(context.app, { guestId: "auction-floor-incumbent" });
    const challenger = await loginAsGuest(context.app, { guestId: "auction-floor-challenger" });
    const { auction, item } = await createActiveAuction(context.prisma, {
      itemCode: JSON.stringify({ itemName: "Auction Floor Blade" }),
      startingBid: 100,
      currentBid: 100,
      currentWinnerId: incumbent.body.playerId
    });

    await context.prisma.auctionBid.create({
      data: {
        itemId: item.id,
        playerId: incumbent.body.playerId,
        bidAmount: 100,
        status: "active",
        isAutoBid: false,
        maxAutoBid: null
      }
    });

    const activeResponse = await context.app.inject({
      method: "GET",
      url: "/v1/auction/active",
      headers: authHeaders(challenger.body.accessToken)
    });
    expect(activeResponse.statusCode).toBe(200);
    expect(activeResponse.json().auctions[0].items[0].minimumNextBid).toBe(110);

    const detailResponse = await context.app.inject({
      method: "GET",
      url: `/v1/auction/${auction.id}`,
      headers: authHeaders(challenger.body.accessToken)
    });
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json().auction.items[0].minimumNextBid).toBe(110);

    const rejectedBidResponse = await context.app.inject({
      method: "POST",
      url: "/v1/auction/bid",
      headers: authHeaders(challenger.body.accessToken),
      payload: {
        itemId: item.id,
        bidAmount: 109
      }
    });
    expect(rejectedBidResponse.statusCode).toBe(400);
    expect(rejectedBidResponse.json().error).toBe("Bid must be at least 110 ducats");
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
    await bidService.placeBid(secondBidder.body.playerId, item.id, 120, true);
    await bidService.triggerAutoBids(item.id, secondBidder.body.playerId);

    const refreshedItem = await context.prisma.auctionItem.findUniqueOrThrow({
      where: { id: item.id }
    });
    expect(refreshedItem.currentWinnerId).toBe(firstBidder.body.playerId);
    expect(refreshedItem.currentBid).toBe(130);

    const secondBidderBalance = await context.prisma.currencyBalance.findUniqueOrThrow({
      where: { playerId: secondBidder.body.playerId }
    });
    expect(secondBidderBalance.ducats).toBe(10_000);

    const maxBidsPerMinute = AuctionConfigService.getInstance().getConfig().bidding.maxBidsPerMinute;
    await context.redis.set(`bid:rate:${firstBidder.body.playerId}`, String(maxBidsPerMinute), "EX", 60);

    await expect(bidService.placeBid(firstBidder.body.playerId, item.id, 130)).rejects.toThrow(/Rate limit exceeded/);
  });

  it("sends mailbox refunds when active bidders are outbid", async () => {
    const incumbent = await loginAsGuest(context.app, { guestId: "proxy-incumbent" });
    const proxyBidder = await loginAsGuest(context.app, { guestId: "proxy-bidder" });
    const challenger = await loginAsGuest(context.app, { guestId: "proxy-challenger" });
    const overbidder = await loginAsGuest(context.app, { guestId: "proxy-overbidder" });

    const { item } = await createActiveAuction(context.prisma, {
      itemCode: JSON.stringify({ itemName: "Proxy Crown" }),
      startingBid: 20,
      currentBid: 30,
      currentWinnerId: incumbent.body.playerId
    });

    await context.prisma.auctionBid.create({
      data: {
        itemId: item.id,
        playerId: incumbent.body.playerId,
        bidAmount: 30,
        status: "active",
        isAutoBid: false,
        maxAutoBid: null
      }
    });

    await setPlayerDucats(context.prisma, incumbent.body.playerId, 9_970);
    await setPlayerDucats(context.prisma, proxyBidder.body.playerId, 10_000);
    await setPlayerDucats(context.prisma, challenger.body.playerId, 10_000);
    await setPlayerDucats(context.prisma, overbidder.body.playerId, 10_000);

    const bidService = new AuctionBidService(context.prisma, context.redis);

    const firstBid = await bidService.placeBid(proxyBidder.body.playerId, item.id, 300);
    expect(firstBid.remainingDucats).toBe(9_700);

    const afterFirstBid = await context.prisma.auctionItem.findUniqueOrThrow({
      where: { id: item.id }
    });
    expect(afterFirstBid.currentWinnerId).toBe(proxyBidder.body.playerId);
    expect(afterFirstBid.currentBid).toBe(40);

    const proxyBidRecord = await context.prisma.auctionBid.findFirstOrThrow({
      where: {
        itemId: item.id,
        playerId: proxyBidder.body.playerId,
        status: "active"
      }
    });
    expect(proxyBidRecord.bidAmount).toBe(40);
    expect(proxyBidRecord.maxAutoBid).toBe(300);

    await expect(
      bidService.placeBid(proxyBidder.body.playerId, item.id, 250)
    ).rejects.toThrow("Bid must be at least 300 ducats");

    const incumbentBalance = await context.prisma.currencyBalance.findUniqueOrThrow({
      where: { playerId: incumbent.body.playerId }
    });
    expect(incumbentBalance.ducats).toBe(9_970);

    const incumbentMailboxResponse = await context.app.inject({
      method: "GET",
      url: "/v1/messages",
      headers: authHeaders(incumbent.body.accessToken)
    });
    expect(incumbentMailboxResponse.statusCode).toBe(200);
    expect(incumbentMailboxResponse.json().entries).toHaveLength(1);
    expect(incumbentMailboxResponse.json().entries[0].sourceType).toBe("auction");
    expect(incumbentMailboxResponse.json().entries[0].subject).toContain("Proxy Crown");
    expect(incumbentMailboxResponse.json().entries[0].subject).toContain("Auction House Wing Lv 1-10");

    const secondBid = await bidService.placeBid(challenger.body.playerId, item.id, 100);
    expect(secondBid.remainingDucats).toBe(10_000);

    const afterSecondBid = await context.prisma.auctionItem.findUniqueOrThrow({
      where: { id: item.id }
    });
    expect(afterSecondBid.currentWinnerId).toBe(proxyBidder.body.playerId);
    expect(afterSecondBid.currentBid).toBe(110);

    const challengerBalance = await context.prisma.currencyBalance.findUniqueOrThrow({
      where: { playerId: challenger.body.playerId }
    });
    expect(challengerBalance.ducats).toBe(10_000);

    const challengerBidRecord = await context.prisma.auctionBid.findFirstOrThrow({
      where: {
        itemId: item.id,
        playerId: challenger.body.playerId
      },
      orderBy: { createdAt: "desc" }
    });
    expect(challengerBidRecord.status).toBe("outbid");
    expect(challengerBidRecord.maxAutoBid).toBe(100);

    const finalBid = await bidService.placeBid(overbidder.body.playerId, item.id, 350);
    expect(finalBid.remainingDucats).toBe(9_650);

    const afterFinalBid = await context.prisma.auctionItem.findUniqueOrThrow({
      where: { id: item.id }
    });
    expect(afterFinalBid.currentWinnerId).toBe(overbidder.body.playerId);
    expect(afterFinalBid.currentBid).toBe(310);

    const proxyBidderBalance = await context.prisma.currencyBalance.findUniqueOrThrow({
      where: { playerId: proxyBidder.body.playerId }
    });
    expect(proxyBidderBalance.ducats).toBe(9_700);

    const proxyMailboxResponse = await context.app.inject({
      method: "GET",
      url: "/v1/messages",
      headers: authHeaders(proxyBidder.body.accessToken)
    });
    expect(proxyMailboxResponse.statusCode).toBe(200);
    expect(proxyMailboxResponse.json().entries).toHaveLength(1);
    expect(proxyMailboxResponse.json().entries[0].sourceType).toBe("auction");
    expect(proxyMailboxResponse.json().entries[0].subject).toContain("Outbid:");

    const proxyMessageId = proxyMailboxResponse.json().entries[0].messageId as string;
    const proxyMessageResponse = await context.app.inject({
      method: "GET",
      url: `/v1/messages/${proxyMessageId}`,
      headers: authHeaders(proxyBidder.body.accessToken)
    });
    expect(proxyMessageResponse.statusCode).toBe(200);
    expect(proxyMessageResponse.json().rewards.ducats).toBe(300);
    expect(proxyMessageResponse.json().body).toContain("Auction House Wing Lv 1-10");
    expect(proxyMessageResponse.json().body).toContain("Proxy Crown");

    const overbidderBidRecord = await context.prisma.auctionBid.findFirstOrThrow({
      where: {
        itemId: item.id,
        playerId: overbidder.body.playerId,
        status: "active"
      }
    });
    expect(overbidderBidRecord.bidAmount).toBe(310);
    expect(overbidderBidRecord.maxAutoBid).toBe(350);
  });

  it("tops up concurrent auction wings without exceeding the configured active count", async () => {
    const instanceService = new AuctionInstanceService(context.prisma);

    await instanceService.createAuctionInstances({
      systemItemScope: "warriorHeavyAndMelee"
    });

    const firstWave = await context.prisma.auctionInstance.findMany({
      where: {
        levelBracketMin: 1,
        levelBracketMax: 10,
        status: "active"
      },
      orderBy: { startTime: "desc" }
    });

    expect(firstWave).toHaveLength(3);

    const initialDurations = firstWave.map((auction) => Math.round((auction.endTime.getTime() - auction.startTime.getTime()) / (60 * 60 * 1000)));
    expect(initialDurations).toEqual([12, 12, 12]);

    await context.prisma.auctionInstance.update({
      where: { id: firstWave[2].id },
      data: {
        endTime: new Date(Date.now() - 60_000)
      }
    });

    await instanceService.createAuctionInstances({
      systemItemScope: "warriorHeavyAndMelee"
    });

    const secondWave = await context.prisma.auctionInstance.findMany({
      where: {
        levelBracketMin: 1,
        levelBracketMax: 10,
        status: "active",
        endTime: { gt: new Date() }
      },
      orderBy: { startTime: "desc" }
    });

    expect(secondWave).toHaveLength(3);
  });

  it("settles auctions idempotently and sends winner rewards to the mailbox", async () => {
    const winner = await loginAsGuest(context.app, { guestId: "auction-winner" });
    const seller = await loginAsGuest(context.app, { guestId: "auction-seller" });
    const rewardItem = await createInventoryItemForPlayer(context.prisma, winner.body.playerId, {
      itemName: "Pending Reward Sword"
    });
    const initialWinnerItemCount = await context.prisma.inventoryItem.count({
      where: {
        playerId: winner.body.playerId,
        itemCode: rewardItem.itemCode
      }
    });
    await setPlayerDucats(context.prisma, winner.body.playerId, 9_400);

    const { auction, item } = await createActiveAuction(context.prisma, {
      itemCode: JSON.stringify(rewardItem),
      currentBid: 310,
      currentWinnerId: winner.body.playerId,
      sellerId: seller.body.playerId,
      isPlayerSubmitted: true,
      feePercentage: 10
    });

    await context.prisma.auctionBid.create({
      data: {
        itemId: item.id,
        playerId: winner.body.playerId,
        bidAmount: 310,
        status: "active",
        isAutoBid: true,
        maxAutoBid: 600
      }
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
    expect(pendingRewards).toHaveLength(0);

    const winnerBalance = await context.prisma.currencyBalance.findUniqueOrThrow({
      where: { playerId: winner.body.playerId }
    });
    expect(winnerBalance.ducats).toBe(9_400);

    const winningBid = await context.prisma.auctionBid.findFirstOrThrow({
      where: {
        itemId: item.id,
        playerId: winner.body.playerId
      }
    });
    expect(winningBid.status).toBe("won");
    expect(winningBid.bidAmount).toBe(310);

    const pendingRewardsResponse = await context.app.inject({
      method: "GET",
      url: "/v1/auction/rewards/pending",
      headers: authHeaders(winner.body.accessToken)
    });
    expect(pendingRewardsResponse.statusCode).toBe(200);
    expect(pendingRewardsResponse.json().rewards).toHaveLength(0);

    const sellerBalance = await context.prisma.currencyBalance.findUniqueOrThrow({
      where: { playerId: seller.body.playerId }
    });
    expect(sellerBalance.ducats).toBeGreaterThan(100_000);

    const mailboxResponse = await context.app.inject({
      method: "GET",
      url: "/v1/messages",
      headers: authHeaders(winner.body.accessToken)
    });
    expect(mailboxResponse.statusCode).toBe(200);
    expect(mailboxResponse.json().entries).toHaveLength(1);
    expect(mailboxResponse.json().entries[0].sourceType).toBe("auction");
    expect(mailboxResponse.json().entries[0].subject).toContain("Pending Reward Sword");
    expect(mailboxResponse.json().entries[0].subject).toContain("Auction House Wing Lv 1-10");

    const mailboxMessageId = mailboxResponse.json().entries[0].messageId as string;
    const mailboxDetailResponse = await context.app.inject({
      method: "GET",
      url: `/v1/messages/${mailboxMessageId}`,
      headers: authHeaders(winner.body.accessToken)
    });
    expect(mailboxDetailResponse.statusCode).toBe(200);
    expect(mailboxDetailResponse.json().rewards.ducats).toBe(290);
    expect(mailboxDetailResponse.json().rewards.items).toHaveLength(1);

    const claimResponse = await context.app.inject({
      method: "POST",
      url: `/v1/messages/${mailboxMessageId}/claim`,
      headers: authHeaders(winner.body.accessToken)
    });
    expect(claimResponse.statusCode).toBe(200);
    expect(claimResponse.json().deletedMessageId).toBe(mailboxMessageId);

    await expect
      .poll(async () => {
        const refreshedBalance = await context.prisma.currencyBalance.findUniqueOrThrow({
          where: { playerId: winner.body.playerId }
        });
        return refreshedBalance.ducats;
      })
      .toBe(9_690);

    await expect
      .poll(async () =>
        context.prisma.inventoryItem.count({
          where: {
            playerId: winner.body.playerId,
            itemCode: rewardItem.itemCode
          }
        })
      )
      .toBeGreaterThan(initialWinnerItemCount);
  });
});
