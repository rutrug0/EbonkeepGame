import { z } from "zod";

export const HOUR_MS = 60 * 60 * 1000;
export const JOB_BOARD_REFRESH_MS = 12 * HOUR_MS;

export type JobsResourceId = "ironOre" | "charcoal" | "supplyCrates" | "seedBundles" | "herbs";
export type JobsFamilyId = "extraction" | "trade" | "foraging";
export type JobAccent = "ember" | "coin" | "verdant";

export type RewardBundle = {
  ducats: number;
  ironOre: number;
  charcoal: number;
  supplyCrates: number;
  seedBundles: number;
  herbs: number;
};

export type FocusOption = {
  id: string;
  label: string;
  description: string;
  bonus: RewardBundle;
};

export type JobTemplate = {
  id: string;
  family: JobsFamilyId;
  name: string;
  eyebrow: string;
  description: string;
  rewardTilt: string;
  futureHook: string;
  imagePath: string;
  fallbackImagePath: string;
  accent: JobAccent;
  hourlyRewards: RewardBundle;
  completionBonusRate: number;
  levelScalingRate: number;
  focusOptions: readonly FocusOption[];
};

export type JobFeaturedWindow = {
  id: string;
  family: JobsFamilyId;
  title: string;
  badge: string;
  description: string;
  rewardMultiplier: number;
  startsAtMs: number;
  endsAtMs: number;
};

export type JobBoardEntry = {
  slotId: JobsFamilyId;
  template: JobTemplate;
  featuredWindow: JobFeaturedWindow | null;
};

export type JobBoardState = {
  entries: readonly JobBoardEntry[];
  refreshAtMs: number;
};

export type JobActiveRunRuntime = {
  runId: string;
  jobId: string;
  jobName: string;
  durationHours: number;
  startedAtMs: number;
  debugOffsetMs: number;
  selectedFocusOptionIds: string[];
  levelRewardMultiplier: number;
  featuredRewardMultiplier: number;
  featuredTitle: string | null;
};

export type JobsHistoryEntry = {
  runId: string;
  jobId: string;
  jobName: string;
  durationHours: number;
  claimType: "completed" | "interrupted";
  claimedAtMs: number;
  rewards: RewardBundle;
};

export const EMPTY_BUNDLE: RewardBundle = Object.freeze({
  ducats: 0,
  ironOre: 0,
  charcoal: 0,
  supplyCrates: 0,
  seedBundles: 0,
  herbs: 0
});

export const JOBS_HERO_BACKGROUND_PATH = "/assets/jobs/jobs-hall-bg.jpg";

export const JOB_ART_BACKDROPS: Record<JobAccent, string> = {
  ember:
    "radial-gradient(circle at center, rgba(191, 119, 56, 0.24), rgba(191, 119, 56, 0.12) 42%, rgba(0, 0, 0, 0) 74%)",
  coin:
    "radial-gradient(circle at center, rgba(177, 151, 76, 0.24), rgba(177, 151, 76, 0.12) 42%, rgba(0, 0, 0, 0) 74%)",
  verdant:
    "radial-gradient(circle at center, rgba(87, 124, 84, 0.24), rgba(87, 124, 84, 0.12) 42%, rgba(0, 0, 0, 0) 74%)"
};

export const RESOURCE_LABELS: Record<JobsResourceId, string> = {
  ironOre: "Iron Ore",
  charcoal: "Charcoal",
  supplyCrates: "Supply Crates",
  seedBundles: "Seed Bundles",
  herbs: "Wild Herbs"
};

export const jobsResourceIdSchema = z.enum(["ironOre", "charcoal", "supplyCrates", "seedBundles", "herbs"]);
export const jobsFamilyIdSchema = z.enum(["extraction", "trade", "foraging"]);
export const jobAccentSchema = z.enum(["ember", "coin", "verdant"]);
export const rewardBundleSchema = z.object({
  ducats: z.number().int().min(0),
  ironOre: z.number().int().min(0),
  charcoal: z.number().int().min(0),
  supplyCrates: z.number().int().min(0),
  seedBundles: z.number().int().min(0),
  herbs: z.number().int().min(0)
});
export const focusOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  bonus: rewardBundleSchema
});
export const jobTemplateSchema = z.object({
  id: z.string().min(1),
  family: jobsFamilyIdSchema,
  name: z.string().min(1),
  eyebrow: z.string().min(1),
  description: z.string().min(1),
  rewardTilt: z.string().min(1),
  futureHook: z.string().min(1),
  imagePath: z.string().min(1),
  fallbackImagePath: z.string().min(1),
  accent: jobAccentSchema,
  hourlyRewards: rewardBundleSchema,
  completionBonusRate: z.number().min(0),
  levelScalingRate: z.number().min(0),
  focusOptions: z.array(focusOptionSchema)
});
export const jobFeaturedWindowSchema = z.object({
  id: z.string().min(1),
  family: jobsFamilyIdSchema,
  title: z.string().min(1),
  badge: z.string().min(1),
  description: z.string().min(1),
  rewardMultiplier: z.number().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime()
});
export const jobBoardEntrySchema = z.object({
  slotId: jobsFamilyIdSchema,
  template: jobTemplateSchema,
  featuredWindow: jobFeaturedWindowSchema.nullable()
});
export const jobsActiveRunSchema = z.object({
  runId: z.string().min(1),
  jobId: z.string().min(1),
  jobName: z.string().min(1),
  durationHours: z.number().int().min(1).max(10),
  startedAt: z.string().datetime(),
  releaseAt: z.string().datetime(),
  debugOffsetMs: z.number().int().min(0),
  selectedFocusOptionIds: z.array(z.string().min(1)),
  levelRewardMultiplier: z.number().min(1),
  featuredRewardMultiplier: z.number().min(1),
  featuredTitle: z.string().nullable()
});
export const jobsHistoryEntrySchema = z.object({
  runId: z.string().min(1),
  jobId: z.string().min(1),
  jobName: z.string().min(1),
  durationHours: z.number().int().min(1).max(10),
  claimType: z.enum(["completed", "interrupted"]),
  claimedAt: z.string().datetime(),
  rewards: rewardBundleSchema
});
export const jobsStateResponseSchema = z.object({
  serverTime: z.string().datetime(),
  boardRefreshAt: z.string().datetime(),
  boardEntries: z.array(jobBoardEntrySchema).length(3),
  refreshesRemaining: z.number().int().min(0).max(2),
  refreshesResetAt: z.string().datetime(),
  activeRun: jobsActiveRunSchema.nullable(),
  stash: rewardBundleSchema,
  history: z.array(jobsHistoryEntrySchema).max(8)
});
export type JobsStateResponse = z.infer<typeof jobsStateResponseSchema>;

export const startJobsRunBodySchema = z.object({
  jobId: z.string().min(1),
  durationHours: z.number().int().min(1).max(10)
});
export type StartJobsRunBody = z.infer<typeof startJobsRunBodySchema>;

export const claimJobsRunBodySchema = z.object({
  claimType: z.enum(["completed", "interrupted"])
});
export type ClaimJobsRunBody = z.infer<typeof claimJobsRunBodySchema>;

export const selectJobsBonusBodySchema = z.object({
  optionId: z.string().min(1)
});
export type SelectJobsBonusBody = z.infer<typeof selectJobsBonusBodySchema>;

export const rerollJobsBoardBodySchema = z.object({}).default({});
export type RerollJobsBoardBody = z.infer<typeof rerollJobsBoardBodySchema>;

export const advanceJobsDebugBodySchema = z.object({
  hours: z.number().int().min(1).max(10)
});
export type AdvanceJobsDebugBody = z.infer<typeof advanceJobsDebugBodySchema>;

export const jobsMutationResponseSchema = z.object({
  jobs: jobsStateResponseSchema,
  ducatsGranted: z.number().int().min(0).default(0)
});
export type JobsMutationResponse = z.infer<typeof jobsMutationResponseSchema>;

const EXTRACTION_FALLBACK_ART = "/assets/jobs/job-mining.png";
const TRADE_FALLBACK_ART = "/assets/jobs/job-caravan.png";
const FORAGING_FALLBACK_ART = "/assets/jobs/job-foraging.png";

type FeaturedBonusTemplate = Omit<JobFeaturedWindow, "id" | "startsAtMs" | "endsAtMs">;

const FEATURED_BONUS_POOLS: Record<JobsFamilyId, readonly FeaturedBonusTemplate[]> = {
  extraction: [
    {
      family: "extraction",
      title: "Ore Rush",
      badge: "+50%",
      description: "Extraction contracts spike while foundries buy out fresh ore.",
      rewardMultiplier: 1.5
    },
    {
      family: "extraction",
      title: "Kiln Demand",
      badge: "+35%",
      description: "Charcoal crews pay above baseline while the kilns stay lit.",
      rewardMultiplier: 1.35
    },
    {
      family: "extraction",
      title: "Quarry Orders",
      badge: "+25%",
      description: "Estate supply orders lift extraction payouts for this board.",
      rewardMultiplier: 1.25
    }
  ],
  trade: [
    {
      family: "trade",
      title: "Merchant Festival",
      badge: "+50%",
      description: "A market rush pushes trade jobs well above their normal ducat line.",
      rewardMultiplier: 1.5
    },
    {
      family: "trade",
      title: "Tariff Spike",
      badge: "+35%",
      description: "Border fees and escorted runs pay a premium for a short window.",
      rewardMultiplier: 1.35
    },
    {
      family: "trade",
      title: "River Toll Surge",
      badge: "+25%",
      description: "Cargo lanes stay crowded and couriers move goods at better margins.",
      rewardMultiplier: 1.25
    }
  ],
  foraging: [
    {
      family: "foraging",
      title: "Rain Bloom",
      badge: "+50%",
      description: "The grounds are flush with growth and foraging pays out far above baseline.",
      rewardMultiplier: 1.5
    },
    {
      family: "foraging",
      title: "Moon Harvest",
      badge: "+35%",
      description: "Night-picking routes are especially rich while the moon cycle holds.",
      rewardMultiplier: 1.35
    },
    {
      family: "foraging",
      title: "Apothecary Rush",
      badge: "+25%",
      description: "Herbal buyers are paying extra while recipe demand stays elevated.",
      rewardMultiplier: 1.25
    }
  ]
};

export const LEGACY_JOB_ID_MIGRATIONS = Object.freeze({
  mining: "iron-vein",
  caravan: "merchant-circuit",
  foraging: "herb-watch"
});

export const JOB_TEMPLATES: readonly JobTemplate[] = [
  {
    id: "iron-vein",
    family: "extraction",
    name: "Iron Vein",
    eyebrow: "Extraction",
    description: "A dependable ore lane built for future smithing and tempering loops.",
    rewardTilt: "High iron ore, steady ducats.",
    futureHook: "Feeds Workshop refinement and early weapon crafting inputs.",
    imagePath: "/assets/jobs/job-iron-vein.png",
    fallbackImagePath: EXTRACTION_FALLBACK_ART,
    accent: "ember",
    hourlyRewards: { ducats: 22, ironOre: 8, charcoal: 1, supplyCrates: 0, seedBundles: 0, herbs: 0 },
    completionBonusRate: 0.055,
    levelScalingRate: 0.028,
    focusOptions: [
      {
        id: "deep-vein",
        label: "Deep Vein",
        description: "Crack a richer seam for extra ore on claim.",
        bonus: { ducats: 0, ironOre: 14, charcoal: 0, supplyCrates: 0, seedBundles: 0, herbs: 0 }
      },
      {
        id: "smelter-claim",
        label: "Smelter Claim",
        description: "Reserve part of the load for a better ducat cut.",
        bonus: { ducats: 130, ironOre: 0, charcoal: 0, supplyCrates: 0, seedBundles: 0, herbs: 0 }
      },
      {
        id: "ore-cart",
        label: "Ore Cart",
        description: "Secure one extra haul before the shift closes.",
        bonus: { ducats: 0, ironOre: 8, charcoal: 2, supplyCrates: 0, seedBundles: 0, herbs: 0 }
      }
    ]
  },
  {
    id: "charcoal-burn",
    family: "extraction",
    name: "Charcoal Burn",
    eyebrow: "Extraction",
    description: "A slower burn job tuned around charcoal output and steady estate fuel.",
    rewardTilt: "Best for charcoal with a side of iron scraps.",
    futureHook: "Supports smelting efficiency, forging fuel, and estate supply chains.",
    imagePath: "/assets/jobs/job-charcoal-burn.png",
    fallbackImagePath: EXTRACTION_FALLBACK_ART,
    accent: "ember",
    hourlyRewards: { ducats: 20, ironOre: 2, charcoal: 6, supplyCrates: 0, seedBundles: 0, herbs: 0 },
    completionBonusRate: 0.06,
    levelScalingRate: 0.027,
    focusOptions: [
      {
        id: "kiln-watch",
        label: "Kiln Watch",
        description: "Stay on the kiln line for more charcoal yield.",
        bonus: { ducats: 0, ironOre: 0, charcoal: 10, supplyCrates: 0, seedBundles: 0, herbs: 0 }
      },
      {
        id: "ash-scrape",
        label: "Ash Scrape",
        description: "Pull usable ore scraps out of the burn pits.",
        bonus: { ducats: 0, ironOre: 6, charcoal: 4, supplyCrates: 0, seedBundles: 0, herbs: 0 }
      },
      {
        id: "fuel-broker",
        label: "Fuel Broker",
        description: "Sell premium fuel loads for extra ducats.",
        bonus: { ducats: 120, ironOre: 0, charcoal: 0, supplyCrates: 0, seedBundles: 0, herbs: 0 }
      }
    ]
  },
  {
    id: "quarry-haul",
    family: "extraction",
    name: "Quarry Haul",
    eyebrow: "Extraction",
    description: "A rough estate contract that pays solid coin and mixed industrial stock.",
    rewardTilt: "Balanced ore, charcoal, and ducats.",
    futureHook: "Good bridge job for later construction and supply-demand events.",
    imagePath: "/assets/jobs/job-quarry-haul.png",
    fallbackImagePath: EXTRACTION_FALLBACK_ART,
    accent: "ember",
    hourlyRewards: { ducats: 30, ironOre: 5, charcoal: 3, supplyCrates: 1, seedBundles: 0, herbs: 0 },
    completionBonusRate: 0.05,
    levelScalingRate: 0.029,
    focusOptions: [
      {
        id: "heavy-pull",
        label: "Heavy Pull",
        description: "Push the crew into one bigger resource haul.",
        bonus: { ducats: 0, ironOre: 9, charcoal: 5, supplyCrates: 0, seedBundles: 0, herbs: 0 }
      },
      {
        id: "wagon-share",
        label: "Wagon Share",
        description: "Take a cleaner pay split from the outbound loads.",
        bonus: { ducats: 150, ironOre: 0, charcoal: 0, supplyCrates: 0, seedBundles: 0, herbs: 0 }
      },
      {
        id: "tool-cache",
        label: "Tool Cache",
        description: "Recover spare supplies from the worksite.",
        bonus: { ducats: 0, ironOre: 0, charcoal: 0, supplyCrates: 3, seedBundles: 0, herbs: 0 }
      }
    ]
  },
  {
    id: "salvage-dredge",
    family: "extraction",
    name: "Salvage Dredge",
    eyebrow: "Extraction",
    description: "A low-depth salvage route that mixes metal scrap with reusable estate crates.",
    rewardTilt: "Good mixed materials, less pure ore than a mine.",
    futureHook: "Sets up later salvage, relic, and workshop-side recycling hooks.",
    imagePath: "/assets/jobs/job-salvage-dredge.png",
    fallbackImagePath: EXTRACTION_FALLBACK_ART,
    accent: "ember",
    hourlyRewards: { ducats: 26, ironOre: 4, charcoal: 2, supplyCrates: 2, seedBundles: 0, herbs: 0 },
    completionBonusRate: 0.048,
    levelScalingRate: 0.03,
    focusOptions: [
      {
        id: "chain-net",
        label: "Chain Net",
        description: "Drag up more salvage and crate stock.",
        bonus: { ducats: 0, ironOre: 4, charcoal: 2, supplyCrates: 4, seedBundles: 0, herbs: 0 }
      },
      {
        id: "scrap-buyer",
        label: "Scrap Buyer",
        description: "Sell the cleaner metal picks for immediate coin.",
        bonus: { ducats: 140, ironOre: 0, charcoal: 0, supplyCrates: 0, seedBundles: 0, herbs: 0 }
      },
      {
        id: "ember-sorting",
        label: "Ember Sorting",
        description: "Separate burnt stock into extra charcoal.",
        bonus: { ducats: 0, ironOre: 0, charcoal: 8, supplyCrates: 0, seedBundles: 0, herbs: 0 }
      }
    ]
  },
  {
    id: "merchant-circuit",
    family: "trade",
    name: "Merchant Circuit",
    eyebrow: "Commerce",
    description: "A clean money lane for reliable ducats between contracts and market loops.",
    rewardTilt: "High ducats with stable crate income.",
    futureHook: "Supports merchant rerolls, auction entry, and sink-heavy estate play.",
    imagePath: "/assets/jobs/job-merchant-circuit.png",
    fallbackImagePath: TRADE_FALLBACK_ART,
    accent: "coin",
    hourlyRewards: { ducats: 72, ironOre: 0, charcoal: 0, supplyCrates: 2, seedBundles: 0, herbs: 0 },
    completionBonusRate: 0.045,
    levelScalingRate: 0.031,
    focusOptions: [
      {
        id: "customs-favor",
        label: "Customs Favor",
        description: "Push for a better customs split on final claim.",
        bonus: { ducats: 200, ironOre: 0, charcoal: 0, supplyCrates: 0, seedBundles: 0, herbs: 0 }
      },
      {
        id: "packed-wagons",
        label: "Packed Wagons",
        description: "Load extra reusable crates onto the return route.",
        bonus: { ducats: 0, ironOre: 0, charcoal: 0, supplyCrates: 4, seedBundles: 0, herbs: 0 }
      },
      {
        id: "merchant-seed",
        label: "Merchant Seed",
        description: "Flip a small side-buy into seed bundles.",
        bonus: { ducats: 0, ironOre: 0, charcoal: 0, supplyCrates: 0, seedBundles: 4, herbs: 0 }
      }
    ]
  },
  {
    id: "tax-escort",
    family: "trade",
    name: "Tax Escort",
    eyebrow: "Commerce",
    description: "Guarded collection runs pay hard coin but lighter secondary goods.",
    rewardTilt: "Very strong ducats, lower material utility.",
    futureHook: "Fits later realm taxes, guild transport, and reputation hooks.",
    imagePath: "/assets/jobs/job-tax-escort.png",
    fallbackImagePath: TRADE_FALLBACK_ART,
    accent: "coin",
    hourlyRewards: { ducats: 80, ironOre: 0, charcoal: 0, supplyCrates: 1, seedBundles: 0, herbs: 0 },
    completionBonusRate: 0.042,
    levelScalingRate: 0.032,
    focusOptions: [
      {
        id: "fast-route",
        label: "Fast Route",
        description: "Shave delays and keep more of the tax margin.",
        bonus: { ducats: 220, ironOre: 0, charcoal: 0, supplyCrates: 0, seedBundles: 0, herbs: 0 }
      },
      {
        id: "ledger-seizure",
        label: "Ledger Seizure",
        description: "Turn confiscated goods into extra supply stock.",
        bonus: { ducats: 0, ironOre: 0, charcoal: 0, supplyCrates: 3, seedBundles: 0, herbs: 0 }
      },
      {
        id: "quiet-collector",
        label: "Quiet Collector",
        description: "Keep the trip smooth and secure a modest herb side lot.",
        bonus: { ducats: 90, ironOre: 0, charcoal: 0, supplyCrates: 0, seedBundles: 0, herbs: 5 }
      }
    ]
  },
  {
    id: "river-cargo",
    family: "trade",
    name: "River Cargo",
    eyebrow: "Commerce",
    description: "A heavier logistics route that leans into crates and broad market throughput.",
    rewardTilt: "Balanced ducats plus strong supply crates.",
    futureHook: "Good support lane for future jobs consumables and travel prep items.",
    imagePath: "/assets/jobs/job-river-cargo.png",
    fallbackImagePath: TRADE_FALLBACK_ART,
    accent: "coin",
    hourlyRewards: { ducats: 58, ironOre: 0, charcoal: 0, supplyCrates: 3, seedBundles: 1, herbs: 0 },
    completionBonusRate: 0.05,
    levelScalingRate: 0.03,
    focusOptions: [
      {
        id: "deck-stow",
        label: "Deck Stow",
        description: "Pack more crate volume into the return leg.",
        bonus: { ducats: 0, ironOre: 0, charcoal: 0, supplyCrates: 5, seedBundles: 0, herbs: 0 }
      },
      {
        id: "port-auction",
        label: "Port Auction",
        description: "Sell the best freight lots at the dock.",
        bonus: { ducats: 170, ironOre: 0, charcoal: 0, supplyCrates: 0, seedBundles: 0, herbs: 0 }
      },
      {
        id: "cargo-swap",
        label: "Cargo Swap",
        description: "Trade spare holds into seed bundles.",
        bonus: { ducats: 0, ironOre: 0, charcoal: 0, supplyCrates: 1, seedBundles: 5, herbs: 0 }
      }
    ]
  },
  {
    id: "smuggler-route",
    family: "trade",
    name: "Smuggler Route",
    eyebrow: "Commerce",
    description: "A swingier black-market lane with strong ducats and mixed side goods.",
    rewardTilt: "High ducats, some herbs and crates.",
    futureHook: "Natural fit for rare contract hooks, rerolls, and shadow-market systems later on.",
    imagePath: "/assets/jobs/job-smuggler-route.png",
    fallbackImagePath: TRADE_FALLBACK_ART,
    accent: "coin",
    hourlyRewards: { ducats: 64, ironOre: 0, charcoal: 0, supplyCrates: 2, seedBundles: 0, herbs: 2 },
    completionBonusRate: 0.052,
    levelScalingRate: 0.033,
    focusOptions: [
      {
        id: "hidden-compartment",
        label: "Hidden Compartment",
        description: "Hide more side stock in the wagons.",
        bonus: { ducats: 0, ironOre: 0, charcoal: 0, supplyCrates: 3, seedBundles: 0, herbs: 6 }
      },
      {
        id: "quiet-sell",
        label: "Quiet Sell",
        description: "Cash out harder on the last exchange.",
        bonus: { ducats: 210, ironOre: 0, charcoal: 0, supplyCrates: 0, seedBundles: 0, herbs: 0 }
      },
      {
        id: "seed-runner",
        label: "Seed Runner",
        description: "Use the shadow market to source seed stock.",
        bonus: { ducats: 0, ironOre: 0, charcoal: 0, supplyCrates: 0, seedBundles: 6, herbs: 0 }
      }
    ]
  },
  {
    id: "herb-watch",
    family: "foraging",
    name: "Herb Watch",
    eyebrow: "Cultivation",
    description: "A steady botanical lane meant to bridge the Garden into future Apothecary loops.",
    rewardTilt: "High herbs, reliable seed bundles.",
    futureHook: "Feeds Garden seed sourcing, potion prep, and estate support crafting.",
    imagePath: "/assets/jobs/job-herb-watch.png",
    fallbackImagePath: FORAGING_FALLBACK_ART,
    accent: "verdant",
    hourlyRewards: { ducats: 18, ironOre: 0, charcoal: 0, supplyCrates: 0, seedBundles: 3, herbs: 6 },
    completionBonusRate: 0.05,
    levelScalingRate: 0.029,
    focusOptions: [
      {
        id: "moon-herbs",
        label: "Moon Herbs",
        description: "Hold for a richer final herb pull.",
        bonus: { ducats: 0, ironOre: 0, charcoal: 0, supplyCrates: 0, seedBundles: 0, herbs: 14 }
      },
      {
        id: "rare-trail",
        label: "Rare Trail",
        description: "Mark a stronger seed route for the return.",
        bonus: { ducats: 0, ironOre: 0, charcoal: 0, supplyCrates: 0, seedBundles: 6, herbs: 0 }
      },
      {
        id: "trail-trader",
        label: "Trail Trader",
        description: "Sell a small high-grade bundle on the side.",
        bonus: { ducats: 100, ironOre: 0, charcoal: 0, supplyCrates: 0, seedBundles: 0, herbs: 0 }
      }
    ]
  },
  {
    id: "mushroom-trail",
    family: "foraging",
    name: "Mushroom Trail",
    eyebrow: "Cultivation",
    description: "A lower-ducat gather route with strong herb volume and useful side seeds.",
    rewardTilt: "Best pure herb stack in the current pool.",
    futureHook: "Supports fungal ingredients, alchemy recipes, and later cave-gathering events.",
    imagePath: "/assets/jobs/job-mushroom-trail.png",
    fallbackImagePath: FORAGING_FALLBACK_ART,
    accent: "verdant",
    hourlyRewards: { ducats: 14, ironOre: 0, charcoal: 0, supplyCrates: 0, seedBundles: 2, herbs: 8 },
    completionBonusRate: 0.052,
    levelScalingRate: 0.028,
    focusOptions: [
      {
        id: "spore-basket",
        label: "Spore Basket",
        description: "Pack a wider gather of wild herb stock.",
        bonus: { ducats: 0, ironOre: 0, charcoal: 0, supplyCrates: 0, seedBundles: 0, herbs: 16 }
      },
      {
        id: "root-markers",
        label: "Root Markers",
        description: "Tag extra seed sites on the trail back.",
        bonus: { ducats: 0, ironOre: 0, charcoal: 0, supplyCrates: 0, seedBundles: 5, herbs: 0 }
      },
      {
        id: "picker-cut",
        label: "Picker Cut",
        description: "Trade a premium basket for extra ducats.",
        bonus: { ducats: 95, ironOre: 0, charcoal: 0, supplyCrates: 0, seedBundles: 0, herbs: 0 }
      }
    ]
  },
  {
    id: "seed-gathering",
    family: "foraging",
    name: "Seed Gathering",
    eyebrow: "Cultivation",
    description: "A garden-first route that pushes seed stock above raw herb output.",
    rewardTilt: "Best for seed bundles with modest ducats.",
    futureHook: "Direct bridge into plot expansion, planting choice, and estate agriculture loops.",
    imagePath: "/assets/jobs/job-seed-gathering.png",
    fallbackImagePath: FORAGING_FALLBACK_ART,
    accent: "verdant",
    hourlyRewards: { ducats: 16, ironOre: 0, charcoal: 0, supplyCrates: 0, seedBundles: 5, herbs: 3 },
    completionBonusRate: 0.048,
    levelScalingRate: 0.03,
    focusOptions: [
      {
        id: "dense-patch",
        label: "Dense Patch",
        description: "Lean into the richest seed line before closing out.",
        bonus: { ducats: 0, ironOre: 0, charcoal: 0, supplyCrates: 0, seedBundles: 8, herbs: 0 }
      },
      {
        id: "apothecary-pouch",
        label: "Apothecary Pouch",
        description: "Trade some gather time into a stronger herb finish.",
        bonus: { ducats: 0, ironOre: 0, charcoal: 0, supplyCrates: 0, seedBundles: 2, herbs: 10 }
      },
      {
        id: "seed-broker",
        label: "Seed Broker",
        description: "Sell a premium seed lot for coin.",
        bonus: { ducats: 105, ironOre: 0, charcoal: 0, supplyCrates: 0, seedBundles: 0, herbs: 0 }
      }
    ]
  },
  {
    id: "alchemy-roots",
    family: "foraging",
    name: "Alchemy Roots",
    eyebrow: "Cultivation",
    description: "A rarer gather lane mixing herbs, seeds, and a bit more cash value.",
    rewardTilt: "Balanced gather route with better ducat floor.",
    futureHook: "Ideal starting point for later alchemy-specific estate loops and recipe chains.",
    imagePath: "/assets/jobs/job-alchemy-roots.png",
    fallbackImagePath: FORAGING_FALLBACK_ART,
    accent: "verdant",
    hourlyRewards: { ducats: 24, ironOre: 0, charcoal: 0, supplyCrates: 0, seedBundles: 3, herbs: 5 },
    completionBonusRate: 0.05,
    levelScalingRate: 0.031,
    focusOptions: [
      {
        id: "root-cellar",
        label: "Root Cellar",
        description: "Preserve the best roots for an upgraded final stock.",
        bonus: { ducats: 0, ironOre: 0, charcoal: 0, supplyCrates: 0, seedBundles: 4, herbs: 9 }
      },
      {
        id: "compound-sell",
        label: "Compound Sell",
        description: "Cash out a refined pack to apothecary buyers.",
        bonus: { ducats: 130, ironOre: 0, charcoal: 0, supplyCrates: 0, seedBundles: 0, herbs: 0 }
      },
      {
        id: "rare-cuttings",
        label: "Rare Cuttings",
        description: "Come back with extra specialist seed stock.",
        bonus: { ducats: 0, ironOre: 0, charcoal: 0, supplyCrates: 0, seedBundles: 7, herbs: 0 }
      }
    ]
  }
] as const;

export const JOB_TEMPLATES_BY_ID = Object.freeze(
  Object.fromEntries(JOB_TEMPLATES.map((template) => [template.id, template])) as Record<string, JobTemplate>
);

const JOB_TEMPLATES_BY_FAMILY: Record<JobsFamilyId, readonly JobTemplate[]> = {
  extraction: JOB_TEMPLATES.filter((template) => template.family === "extraction"),
  trade: JOB_TEMPLATES.filter((template) => template.family === "trade"),
  foraging: JOB_TEMPLATES.filter((template) => template.family === "foraging")
};

function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function pickDeterministic<T>(items: readonly T[], seed: string): T {
  return items[hashString(seed) % items.length];
}

function buildFeaturedWindow(cycle: number, cycleStartMs: number, cycleEndMs: number): JobFeaturedWindow | null {
  if (hashString(`jobs-featured-roll-${cycle}`) % 100 >= 42) {
    return null;
  }

  const family = pickDeterministic<JobsFamilyId>(["extraction", "trade", "foraging"], `jobs-featured-family-${cycle}`);
  const template = pickDeterministic(FEATURED_BONUS_POOLS[family], `jobs-featured-template-${cycle}`);

  return {
    id: `${family}-${cycle}`,
    family,
    title: template.title,
    badge: template.badge,
    description: template.description,
    rewardMultiplier: template.rewardMultiplier,
    startsAtMs: cycleStartMs,
    endsAtMs: cycleEndMs
  };
}

export function buildJobBoardState(nowMs: number, boardNonce = 0): JobBoardState {
  const cycle = Math.floor(nowMs / JOB_BOARD_REFRESH_MS);
  const cycleStartMs = cycle * JOB_BOARD_REFRESH_MS;
  const cycleEndMs = cycleStartMs + JOB_BOARD_REFRESH_MS;
  const featuredWindow = buildFeaturedWindow(cycle + boardNonce, cycleStartMs, cycleEndMs);

  const extractionTemplate = pickDeterministic(JOB_TEMPLATES_BY_FAMILY.extraction, `jobs-extraction-${cycle}-${boardNonce}`);
  const tradeTemplate = pickDeterministic(JOB_TEMPLATES_BY_FAMILY.trade, `jobs-trade-${cycle}-${boardNonce}`);
  const foragingTemplate = pickDeterministic(JOB_TEMPLATES_BY_FAMILY.foraging, `jobs-foraging-${cycle}-${boardNonce}`);

  return {
    entries: [
      {
        slotId: "extraction",
        template: extractionTemplate,
        featuredWindow: featuredWindow?.family === "extraction" ? featuredWindow : null
      },
      {
        slotId: "trade",
        template: tradeTemplate,
        featuredWindow: featuredWindow?.family === "trade" ? featuredWindow : null
      },
      {
        slotId: "foraging",
        template: foragingTemplate,
        featuredWindow: featuredWindow?.family === "foraging" ? featuredWindow : null
      }
    ],
    refreshAtMs: cycleEndMs
  };
}

export function getPlayerLevelRewardMultiplier(template: JobTemplate, playerLevel: number | null | undefined): number {
  const safeLevel = Math.max(1, Math.floor(playerLevel ?? 1));
  return 1 + Math.max(0, safeLevel - 1) * template.levelScalingRate;
}

export function buildRunReleaseAtMs(run: JobActiveRunRuntime): number {
  return run.startedAtMs + run.durationHours * HOUR_MS - run.debugOffsetMs;
}

export function getCompletedHours(run: JobActiveRunRuntime, nowMs: number): number {
  const elapsedMs = Math.max(0, nowMs - run.startedAtMs + run.debugOffsetMs);
  return Math.min(run.durationHours, Math.floor(elapsedMs / HOUR_MS));
}

export function getElapsedMs(run: JobActiveRunRuntime, nowMs: number): number {
  return Math.max(0, nowMs - run.startedAtMs + run.debugOffsetMs);
}

export function getFocusUnlockHours(durationHours: number): number[] {
  return [3, 6, 9].filter((hour) => hour <= durationHours);
}

export function addRewardBundles(base: RewardBundle, delta: RewardBundle): RewardBundle {
  return {
    ducats: base.ducats + delta.ducats,
    ironOre: base.ironOre + delta.ironOre,
    charcoal: base.charcoal + delta.charcoal,
    supplyCrates: base.supplyCrates + delta.supplyCrates,
    seedBundles: base.seedBundles + delta.seedBundles,
    herbs: base.herbs + delta.herbs
  };
}

export function multiplyRewardBundle(bundle: RewardBundle, multiplier: number): RewardBundle {
  return {
    ducats: Math.floor(bundle.ducats * multiplier),
    ironOre: Math.floor(bundle.ironOre * multiplier),
    charcoal: Math.floor(bundle.charcoal * multiplier),
    supplyCrates: Math.floor(bundle.supplyCrates * multiplier),
    seedBundles: Math.floor(bundle.seedBundles * multiplier),
    herbs: Math.floor(bundle.herbs * multiplier)
  };
}

export function getRewardBundleForHours(bundle: RewardBundle, hours: number): RewardBundle {
  return {
    ducats: bundle.ducats * hours,
    ironOre: bundle.ironOre * hours,
    charcoal: bundle.charcoal * hours,
    supplyCrates: bundle.supplyCrates * hours,
    seedBundles: bundle.seedBundles * hours,
    herbs: bundle.herbs * hours
  };
}

export function resolveFocusBonus(run: JobActiveRunRuntime): RewardBundle {
  const definition = JOB_TEMPLATES_BY_ID[run.jobId];
  return run.selectedFocusOptionIds.reduce((bundle, optionId) => {
    const option = definition.focusOptions.find((focusOption) => focusOption.id === optionId);
    return option ? addRewardBundles(bundle, option.bonus) : bundle;
  }, { ...EMPTY_BUNDLE });
}

export function resolveRunRewards(args: {
  run: JobActiveRunRuntime;
  nowMs: number;
  claimType: "completed" | "interrupted";
}): RewardBundle {
  const definition = JOB_TEMPLATES_BY_ID[args.run.jobId];
  const completedHours = getCompletedHours(args.run, args.nowMs);
  const scaledHourlyRewards = multiplyRewardBundle(
    definition.hourlyRewards,
    args.run.levelRewardMultiplier * args.run.featuredRewardMultiplier
  );
  const baseRewards = getRewardBundleForHours(scaledHourlyRewards, completedHours);
  const focusBonus = resolveFocusBonus(args.run);
  const combinedRewards = addRewardBundles(baseRewards, focusBonus);

  if (args.claimType === "interrupted") {
    return multiplyRewardBundle(combinedRewards, 0.5);
  }

  const completionMultiplier = 1 + Math.max(0, args.run.durationHours - 1) * definition.completionBonusRate;
  return addRewardBundles(multiplyRewardBundle(baseRewards, completionMultiplier), focusBonus);
}
