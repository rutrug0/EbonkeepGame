import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface AuctionConfig {
  instance: {
    maxPlayersPerInstance: number;
    concurrentAuctionsPerBracket: number;
    itemsPerAuction: number;
    auctionDurationHours: number;
    auctionStartTimesUtc: number[];
  };
  items: {
    rarityDistribution: { common: number; uncommon: number; rare: number; epic: number };
    systemGeneratedPercentage: number;
  };
  bidding: {
    minBidIncrementPercentage: number;
    minBidIncrementAbsolute: number;
    startingBidPercentage: number;
    maxBidsPerMinute: number;
    autoBidEnabled: boolean;
  };
  snipeProtection: {
    enabled: boolean;
    triggerWindowMinutes: number;
    extensionDurationMinutes: number;
    maxExtensionsPerItem: number;
  };
  fees: {
    playerItemFeePercentage: number;
    systemItemFeePercentage: number;
    listingFeeEnabled: boolean;
    listingFeeDucats: number;
  };
  rewards: {
    pendingRewardExpiryDays: number;
    expiredRewardRefundPercentage: number;
  };
  levelBrackets: {
    bracketSize: number;
    maxLevel: number;
  };
  settlement: {
    settlementCheckIntervalMinutes: number;
    expiredRewardsCheckIntervalMinutes: number;
  };
  itemGeneration: {
    baseValuePerLevel: number;
    rarityMultipliers: { common: number; uncommon: number; rare: number; epic: number };
  };
  economy: {
    auctionCurrency: string;
    allowImperials: boolean;
    minPlayerLevel: number;
    minPlayerLevelSubmit: number;
    maxPlayerActiveSubmissions: number;
  };
  ui: {
    bidHistoryLimit: number;
    uiPollIntervalSeconds: number;
    showPlayerNames: boolean;
  };
  debug: {
    enableTestEndpoints: boolean;
    verboseLogging: boolean;
  };
}

/**
 * Parse INI file into key-value pairs
 */
function parseIniFile(filePath: string): Record<string, Record<string, string>> {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const config: Record<string, Record<string, string>> = {};
  let currentSection = "";

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(";")) {
      continue;
    }

    // Section header
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      currentSection = trimmed.slice(1, -1);
      config[currentSection] = {};
      continue;
    }

    // Key-value pair
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match && currentSection) {
      const key = match[1].trim();
      const value = match[2].trim();
      config[currentSection][key] = value;
    }
  }

  return config;
}

function resolveAuctionConfigPath(explicitPath?: string): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const configuredPath = explicitPath || process.env.AUCTION_CONFIG_PATH;

  const candidatePaths = [
    configuredPath,
    path.resolve(moduleDir, "..", "auction_config.ini"),
    path.resolve(moduleDir, "..", "..", "..", "modules", "auction", "auction_config.ini"),
    path.resolve(moduleDir, "..", "..", "..", "..", "src", "modules", "auction", "auction_config.ini"),
    path.resolve(process.cwd(), "src", "modules", "auction", "auction_config.ini"),
    path.resolve(process.cwd(), "apps", "api", "src", "modules", "auction", "auction_config.ini")
  ].filter((candidate): candidate is string => Boolean(candidate));

  const resolvedPath = candidatePaths.find((candidate) => fs.existsSync(candidate));
  if (!resolvedPath) {
    throw new Error(`Auction config file not found. Checked: ${candidatePaths.join(", ")}`);
  }

  return resolvedPath;
}

/**
 * Load and parse auction configuration from auction_config.ini
 */
export class AuctionConfigService {
  private static instance: AuctionConfigService;
  private config: AuctionConfig;

  private constructor(configPath?: string) {
    const iniPath = resolveAuctionConfigPath(configPath);

    const ini = parseIniFile(iniPath);
    this.config = this.parseConfig(ini);
  }

  /**
   * Get singleton instance
   */
  static getInstance(configPath?: string): AuctionConfigService {
    if (!AuctionConfigService.instance) {
      AuctionConfigService.instance = new AuctionConfigService(configPath);
    }
    return AuctionConfigService.instance;
  }

  /**
   * Get configuration object
   */
  getConfig(): AuctionConfig {
    return this.config;
  }

  /**
   * Parse INI structure into typed config
   */
  private parseConfig(ini: Record<string, Record<string, string>>): AuctionConfig {
    const rarityDist = ini["auction.items"].rarity_distribution.split(",").map(Number);
    const startTimes = ini["auction.instance"].auction_start_times_utc.split(",").map(Number);
    const rarityMults = ini["auction.item_generation"].rarity_multipliers.split(",").map(Number);

    return {
      instance: {
        maxPlayersPerInstance: Number(ini["auction.instance"].max_players_per_instance),
        concurrentAuctionsPerBracket: Number(ini["auction.instance"].concurrent_auctions_per_bracket),
        itemsPerAuction: Number(ini["auction.instance"].items_per_auction),
        auctionDurationHours: Number(ini["auction.instance"].auction_duration_hours),
        auctionStartTimesUtc: startTimes
      },
      items: {
        rarityDistribution: {
          common: rarityDist[0],
          uncommon: rarityDist[1],
          rare: rarityDist[2],
          epic: rarityDist[3]
        },
        systemGeneratedPercentage: Number(ini["auction.items"].system_generated_percentage)
      },
      bidding: {
        minBidIncrementPercentage: Number(ini["auction.bidding"].min_bid_increment_percentage),
        minBidIncrementAbsolute: Number(ini["auction.bidding"].min_bid_increment_absolute),
        startingBidPercentage: Number(ini["auction.bidding"].starting_bid_percentage),
        maxBidsPerMinute: Number(ini["auction.bidding"].max_bids_per_minute),
        autoBidEnabled: ini["auction.bidding"].auto_bid_enabled === "1"
      },
      snipeProtection: {
        enabled: ini["auction.snipe_protection"].snipe_protection_enabled === "1",
        triggerWindowMinutes: Number(ini["auction.snipe_protection"].snipe_trigger_window_minutes),
        extensionDurationMinutes: Number(ini["auction.snipe_protection"].extension_duration_minutes),
        maxExtensionsPerItem: Number(ini["auction.snipe_protection"].max_extensions_per_item)
      },
      fees: {
        playerItemFeePercentage: Number(ini["auction.fees"].player_item_fee_percentage),
        systemItemFeePercentage: Number(ini["auction.fees"].system_item_fee_percentage),
        listingFeeEnabled: ini["auction.fees"].listing_fee_enabled === "1",
        listingFeeDucats: Number(ini["auction.fees"].listing_fee_ducats)
      },
      rewards: {
        pendingRewardExpiryDays: Number(ini["auction.rewards"].pending_reward_expiry_days),
        expiredRewardRefundPercentage: Number(ini["auction.rewards"].expired_reward_refund_percentage)
      },
      levelBrackets: {
        bracketSize: Number(ini["auction.level_brackets"].bracket_size),
        maxLevel: Number(ini["auction.level_brackets"].max_level)
      },
      settlement: {
        settlementCheckIntervalMinutes: Number(ini["auction.settlement"].settlement_check_interval_minutes),
        expiredRewardsCheckIntervalMinutes: Number(
          ini["auction.settlement"].expired_rewards_check_interval_minutes
        )
      },
      itemGeneration: {
        baseValuePerLevel: Number(ini["auction.item_generation"].base_value_per_level),
        rarityMultipliers: {
          common: rarityMults[0],
          uncommon: rarityMults[1],
          rare: rarityMults[2],
          epic: rarityMults[3]
        }
      },
      economy: {
        auctionCurrency: ini["auction.economy"].auction_currency,
        allowImperials: ini["auction.economy"].allow_imperials === "1",
        minPlayerLevel: Number(ini["auction.economy"].min_player_level),
        minPlayerLevelSubmit: Number(ini["auction.economy"].min_player_level_submit),
        maxPlayerActiveSubmissions: Number(ini["auction.economy"].max_player_active_submissions || 5)
      },
      ui: {
        bidHistoryLimit: Number(ini["auction.ui"].bid_history_limit),
        uiPollIntervalSeconds: Number(ini["auction.ui"].ui_poll_interval_seconds),
        showPlayerNames: ini["auction.ui"].show_player_names === "1"
      },
      debug: {
        enableTestEndpoints: ini["auction.debug"].enable_test_endpoints === "1",
        verboseLogging: ini["auction.debug"].verbose_logging === "1"
      }
    };
  }

  /**
   * Generate level brackets based on config
   */
  getLevelBrackets(): Array<{ min: number; max: number }> {
    const { bracketSize, maxLevel } = this.config.levelBrackets;
    const brackets: Array<{ min: number; max: number }> = [];

    for (let min = 1; min <= maxLevel; min += bracketSize) {
      const max = Math.min(min + bracketSize - 1, maxLevel);
      brackets.push({ min, max });
    }

    return brackets;
  }

  /**
   * Calculate minimum bid based on current bid
   */
  calculateMinBid(currentBid: number, startingBid: number): number {
    if (currentBid === 0) {
      return startingBid;
    }

    const percentIncrement = Math.ceil(
      (currentBid * this.config.bidding.minBidIncrementPercentage) / 100
    );
    const increment = Math.max(this.config.bidding.minBidIncrementAbsolute, percentIncrement);
    return currentBid + increment;
  }

  /**
   * Calculate the minimum accepted reserve for a newly submitted bid.
   * This stays aligned with the visible floor returned to clients.
   */
  calculateMinimumAcceptedBid(currentBid: number, startingBid: number): number {
    const visibleBase = currentBid > 0 ? currentBid : startingBid;
    return Math.max(this.calculateMinBid(currentBid, startingBid), visibleBase + 11);
  }

  /**
   * Calculate starting bid for an item
   */
  calculateStartingBid(itemLevel: number, rarity: "common" | "uncommon" | "rare" | "epic"): number {
    const { baseValuePerLevel, rarityMultipliers } = this.config.itemGeneration;
    const baseValue = itemLevel * baseValuePerLevel;
    const rarityMult = rarityMultipliers[rarity];
    const startingBidPct = this.config.bidding.startingBidPercentage / 100;

    return Math.floor(baseValue * rarityMult * startingBidPct);
  }

  /**
   * Calculate auction end time based on config
   */
  calculateAuctionEndTime(startTime: Date): Date {
    const durationMs = this.config.instance.auctionDurationHours * 60 * 60 * 1000;
    return new Date(startTime.getTime() + durationMs);
  }

  /**
   * Calculate seller proceeds after auction house fee
   */
  calculateSellerProceeds(winningBid: number, isPlayerSubmitted: boolean): {
    fee: number;
    sellerProceeds: number;
  } {
    const feePercentage = isPlayerSubmitted
      ? this.config.fees.playerItemFeePercentage
      : this.config.fees.systemItemFeePercentage;

    const fee = Math.floor((winningBid * feePercentage) / 100);
    const sellerProceeds = winningBid - fee;

    return { fee, sellerProceeds };
  }
}
