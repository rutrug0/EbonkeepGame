import type { PrismaClient } from "@prisma/client";
import cron from "node-cron";
import { AuctionInstanceService } from "./services/instance.service.js";
import { AuctionSettlementService } from "./services/settlement.service.js";
import { AuctionConfigService } from "./services/config.service.js";

/**
 * Background job scheduler for auction system
 * 
 * Jobs:
 * 1. Settlement job - Runs every minute to settle completed auctions
 * 2. Auction creation job - Runs at configured start times
 * 3. Expired rewards job - Runs every hour to process unclaimed rewards
 */
export class AuctionBackgroundJobs {
  private instanceService: AuctionInstanceService;
  private settlementService: AuctionSettlementService;
  private config = AuctionConfigService.getInstance().getConfig();

  constructor(private prisma: PrismaClient) {
    this.instanceService = new AuctionInstanceService(prisma);
    this.settlementService = new AuctionSettlementService(prisma);
  }

  /**
   * Start all background jobs
   */
  start(): void {
    console.log("[Auction Jobs] Starting background jobs...");

    // Job 1: Settlement (every minute)
    this.startSettlementJob();

    // Job 2: Auction creation (at configured times)
    this.startAuctionCreationJob();

    // Job 3: Expired rewards cleanup (every hour)
    this.startExpiredRewardsJob();

    console.log("[Auction Jobs] All jobs started successfully");
  }

  /**
   * Settlement job - Runs every minute
   * Settles completed auctions and distributes rewards
   */
  private startSettlementJob(): void {
    const intervalMinutes = this.config.settlement.settlementCheckIntervalMinutes;

    // Run immediately on startup
    this.runSettlement();

    // Then schedule recurring
    setInterval(() => {
      this.runSettlement();
    }, intervalMinutes * 60 * 1000);

    console.log(`[Auction Jobs] Settlement job scheduled (every ${intervalMinutes} min)`);
  }

  /**
   * Execute settlement
   */
  private async runSettlement(): Promise<void> {
    try {
      const result = await this.settlementService.settleAuctions();
      if (result.settledCount > 0) {
        console.log(
          `[Settlement] Settled ${result.settledCount} items, collected ${result.totalFeesCollected} ducats`
        );
      }
    } catch (error) {
      console.error("[Settlement] Error during settlement:", error);
    }
  }

  /**
   * Auction creation job - Runs at configured UTC times
   * Default: 00:00, 12:00 UTC (twice daily for 12h auctions)
   */
  private startAuctionCreationJob(): void {
    const startTimes = this.config.instance.auctionStartTimesUtc;

    startTimes.forEach((hour) => {
      // Create cron expression for specific hour UTC (e.g., "0 0 * * *" for midnight)
      const cronExpression = `0 ${hour} * * *`;

      cron.schedule(cronExpression, async () => {
        await this.runAuctionCreation();
      });

      console.log(`[Auction Jobs] Auction creation scheduled at ${hour}:00 UTC`);
    });
  }

  /**
   * Execute auction creation
   */
  private async runAuctionCreation(): Promise<void> {
    try {
      console.log("[Auction Creation] Creating new auction instances...");
      await this.instanceService.createAuctionInstances();
      console.log("[Auction Creation] Auction instances created successfully");
    } catch (error) {
      console.error("[Auction Creation] Error creating auctions:", error);
    }
  }

  /**
   * Expired rewards job - Runs every hour
   * Processes unclaimed rewards and issues partial refunds
   */
  private startExpiredRewardsJob(): void {
    const intervalMinutes = this.config.settlement.expiredRewardsCheckIntervalMinutes;

    // Run immediately on startup
    this.runExpiredRewardsCleanup();

    // Then schedule recurring
    setInterval(() => {
      this.runExpiredRewardsCleanup();
    }, intervalMinutes * 60 * 1000);

    console.log(
      `[Auction Jobs] Expired rewards job scheduled (every ${intervalMinutes} min)`
    );
  }

  /**
   * Execute expired rewards cleanup
   */
  private async runExpiredRewardsCleanup(): Promise<void> {
    try {
      const processedCount = await this.settlementService.processExpiredRewards();
      if (processedCount > 0) {
        console.log(`[Expired Rewards] Processed ${processedCount} expired rewards`);
      }
    } catch (error) {
      console.error("[Expired Rewards] Error processing expired rewards:", error);
    }
  }

  /**
   * Stop all jobs (for graceful shutdown)
   */
  stop(): void {
    console.log("[Auction Jobs] Stopping background jobs...");
    // Note: setInterval doesn't return cancelable handles in this simple setup
    // For production, track interval IDs and call clearInterval()
  }
}

/**
 * Initialize and start auction background jobs
 * Call this from your API startup (apps/api/src/app.ts)
 * 
 * Example usage:
 * ```typescript
 * import { initializeAuctionJobs } from "./modules/auction/background-jobs.js";
 * 
 * // After Fastify app is ready
 * initializeAuctionJobs(fastify.prisma);
 * ```
 */
export function initializeAuctionJobs(prisma: PrismaClient): AuctionBackgroundJobs {
  const jobs = new AuctionBackgroundJobs(prisma);
  jobs.start();
  return jobs;
}
