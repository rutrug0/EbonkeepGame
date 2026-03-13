/**
 * Guild Academy tech-tree configuration.
 *
 * HOW TO ADD NODES / BRANCHES:
 *   1. Add a new entry to `branches` if you need a new branch.
 *   2. Add node entries to `nodes` with the correct `branchId` and `prerequisites`.
 *   3. All positions use a 1000×1000 coordinate space with centre at (500, 500).
 *   4. `ducatCost` per level = additional ducats needed to unlock THAT specific level.
 *      The service computes cumulative costs automatically.
 *   5. Deploy / restart the API — no DB changes needed for tree structure.
 *
 * DESIGN PRINCIPLES:
 *   • Config-driven: no business logic in this file.
 *   • Reward values are informational; application of effects is done in the game services
 *     that read this config (Phase 2).
 *   • `hiddenUntilUnlocked: true` hides the node on the UI until all prerequisites are met.
 */

import type { AcademyTreeConfig } from "@ebonkeep/shared/guild";

export const ACADEMY_TREE_CONFIG: AcademyTreeConfig = {
  version: 1,
  centerNodeId: "academy_core",

  // ─── Branches ──────────────────────────────────────────────────────────────
  branches: [
    {
      id: "core",
      label: "Academy Core",
      description: "The foundation of all guild research.",
      iconKey: "branch_core",
      color: "#D4AF37"
    },
    {
      id: "combat",
      label: "Combat Mastery",
      description: "Strengthen your guild's warriors through martial training.",
      iconKey: "branch_combat",
      color: "#C0392B",
      completionReward: {
        type: "guild_combat_power_pct",
        value: 10,
        description: "+10% Combat Power (Combat branch completion)"
      }
    },
    {
      id: "arcane",
      label: "Arcane Arts",
      description: "Master the mystical forces for arcane supremacy.",
      iconKey: "branch_arcane",
      color: "#8E44AD",
      completionReward: {
        type: "guild_arcane_resistance_pct",
        value: 10,
        description: "+10% Arcane Resistance (Arcane branch completion)"
      }
    },
    {
      id: "guild",
      label: "Guild Organization",
      description: "Improve your guild's structure, capacity, and leadership.",
      iconKey: "branch_guild",
      color: "#E67E22",
      completionReward: {
        type: "guild_max_members",
        value: 10,
        description: "+10 Max Members (Guild branch completion)"
      }
    },
    {
      id: "commerce",
      label: "Commerce",
      description: "Develop trade networks that enrich every guild member.",
      iconKey: "branch_commerce",
      color: "#27AE60",
      completionReward: {
        type: "guild_ducat_find_pct",
        value: 10,
        description: "+10% Ducat Find (Commerce branch completion)"
      }
    }
  ],

  // ─── Nodes ─────────────────────────────────────────────────────────────────
  nodes: [
    // ═══════════════════════════════════════════════════════════════════════
    // CORE
    // ═══════════════════════════════════════════════════════════════════════
    {
      id: "academy_core",
      branchId: "core",
      label: "Academy Core",
      description:
        "Establish the Academy as the centre of guild knowledge. Unlocks all research branches.",
      iconKey: "node_academy_core",
      position: { x: 500, y: 500 },
      prerequisites: [],
      maxLevel: 1,
      levels: [
        {
          level: 1,
          ducatCost: 15000,
          rewards: []
        }
      ],
      hiddenUntilUnlocked: false
    },

    // ═══════════════════════════════════════════════════════════════════════
    // COMBAT BRANCH  →  branches right from centre
    // ═══════════════════════════════════════════════════════════════════════
    {
      id: "combat_basics",
      branchId: "combat",
      label: "Combat Basics",
      description: "Fundamental martial training that gives every guild member a combat edge.",
      iconKey: "node_combat_basics",
      position: { x: 700, y: 500 },
      prerequisites: [{ nodeId: "academy_core", minLevel: 1 }],
      maxLevel: 5,
      levels: [
        { level: 1, ducatCost: 5000,  rewards: [{ type: "guild_combat_power_pct", value: 1, description: "+1% Combat Power" }] },
        { level: 2, ducatCost: 8000,  rewards: [{ type: "guild_combat_power_pct", value: 1, description: "+1% Combat Power" }] },
        { level: 3, ducatCost: 12000, rewards: [{ type: "guild_combat_power_pct", value: 1, description: "+1% Combat Power" }] },
        { level: 4, ducatCost: 20000, rewards: [{ type: "guild_combat_power_pct", value: 1, description: "+1% Combat Power" }] },
        { level: 5, ducatCost: 30000, rewards: [{ type: "guild_combat_power_pct", value: 2, description: "+2% Combat Power" }] }
      ],
      hiddenUntilUnlocked: false,
      completionReward: { type: "guild_combat_power_pct", value: 5, description: "+5% Combat Power (completion bonus)" }
    },
    {
      id: "heavy_arms",
      branchId: "combat",
      label: "Heavy Arms",
      description: "Mastery of heavy weapons and armour that grants superior offensive potential.",
      iconKey: "node_heavy_arms",
      position: { x: 870, y: 415 },
      prerequisites: [{ nodeId: "combat_basics", minLevel: 3 }],
      maxLevel: 4,
      levels: [
        { level: 1, ducatCost: 10000, rewards: [{ type: "guild_combat_power_pct", value: 2, description: "+2% Combat Power" }] },
        { level: 2, ducatCost: 18000, rewards: [{ type: "guild_combat_power_pct", value: 2, description: "+2% Combat Power" }] },
        { level: 3, ducatCost: 28000, rewards: [{ type: "guild_combat_power_pct", value: 3, description: "+3% Combat Power" }] },
        { level: 4, ducatCost: 40000, rewards: [{ type: "guild_combat_power_pct", value: 3, description: "+3% Combat Power" }] }
      ],
      hiddenUntilUnlocked: false,
      completionReward: { type: "guild_combat_power_pct", value: 8, description: "+8% Combat Power (completion bonus)" }
    },
    {
      id: "swift_strike",
      branchId: "combat",
      label: "Swift Strike",
      description: "Lightweight combat techniques that prioritise speed and precision.",
      iconKey: "node_swift_strike",
      position: { x: 870, y: 585 },
      prerequisites: [{ nodeId: "combat_basics", minLevel: 3 }],
      maxLevel: 4,
      levels: [
        { level: 1, ducatCost: 10000, rewards: [{ type: "member_xp_gain_pct", value: 2, description: "+2% XP Gain" }] },
        { level: 2, ducatCost: 18000, rewards: [{ type: "member_xp_gain_pct", value: 2, description: "+2% XP Gain" }] },
        { level: 3, ducatCost: 28000, rewards: [{ type: "member_xp_gain_pct", value: 3, description: "+3% XP Gain" }] },
        { level: 4, ducatCost: 40000, rewards: [{ type: "member_xp_gain_pct", value: 3, description: "+3% XP Gain" }] }
      ],
      hiddenUntilUnlocked: false,
      completionReward: { type: "member_xp_gain_pct", value: 5, description: "+5% XP Gain (completion bonus)" }
    },
    {
      id: "warlord_creed",
      branchId: "combat",
      label: "Warlord's Creed",
      description:
        "The ultimate expression of martial doctrine — reserved for guilds who have mastered both weapons and speed.",
      iconKey: "node_warlord_creed",
      position: { x: 990, y: 500 },
      prerequisites: [
        { nodeId: "heavy_arms",   minLevel: 4 },
        { nodeId: "swift_strike", minLevel: 4 }
      ],
      maxLevel: 3,
      levels: [
        { level: 1, ducatCost: 50000, rewards: [{ type: "guild_combat_power_pct", value: 5, description: "+5% Combat Power" }] },
        { level: 2, ducatCost: 80000, rewards: [{ type: "guild_combat_power_pct", value: 5, description: "+5% Combat Power" }] },
        { level: 3, ducatCost: 120000, rewards: [{ type: "guild_combat_power_pct", value: 10, description: "+10% Combat Power" }] }
      ],
      hiddenUntilUnlocked: true,
      completionReward: { type: "guild_combat_power_pct", value: 15, description: "+15% Combat Power (completion bonus)" }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // ARCANE BRANCH  →  branches left from centre
    // ═══════════════════════════════════════════════════════════════════════
    {
      id: "arcane_basics",
      branchId: "arcane",
      label: "Arcane Basics",
      description: "Introduction to arcane theory that bolsters every mage in the guild.",
      iconKey: "node_arcane_basics",
      position: { x: 300, y: 500 },
      prerequisites: [{ nodeId: "academy_core", minLevel: 1 }],
      maxLevel: 5,
      levels: [
        { level: 1, ducatCost: 5000,  rewards: [{ type: "guild_arcane_resistance_pct", value: 1, description: "+1% Arcane Resistance" }] },
        { level: 2, ducatCost: 8000,  rewards: [{ type: "guild_arcane_resistance_pct", value: 1, description: "+1% Arcane Resistance" }] },
        { level: 3, ducatCost: 12000, rewards: [{ type: "guild_arcane_resistance_pct", value: 1, description: "+1% Arcane Resistance" }] },
        { level: 4, ducatCost: 20000, rewards: [{ type: "guild_arcane_resistance_pct", value: 1, description: "+1% Arcane Resistance" }] },
        { level: 5, ducatCost: 30000, rewards: [{ type: "guild_arcane_resistance_pct", value: 2, description: "+2% Arcane Resistance" }] }
      ],
      hiddenUntilUnlocked: false,
      completionReward: { type: "guild_arcane_resistance_pct", value: 5, description: "+5% Arcane Resistance (completion bonus)" }
    },
    {
      id: "runic_shields",
      branchId: "arcane",
      label: "Runic Shields",
      description: "Ancient runes woven into armour that deflect magical attacks.",
      iconKey: "node_runic_shields",
      position: { x: 130, y: 415 },
      prerequisites: [{ nodeId: "arcane_basics", minLevel: 3 }],
      maxLevel: 4,
      levels: [
        { level: 1, ducatCost: 10000, rewards: [{ type: "guild_arcane_resistance_pct", value: 2, description: "+2% Arcane Resistance" }] },
        { level: 2, ducatCost: 18000, rewards: [{ type: "guild_arcane_resistance_pct", value: 2, description: "+2% Arcane Resistance" }] },
        { level: 3, ducatCost: 28000, rewards: [{ type: "guild_arcane_resistance_pct", value: 3, description: "+3% Arcane Resistance" }] },
        { level: 4, ducatCost: 40000, rewards: [{ type: "guild_arcane_resistance_pct", value: 3, description: "+3% Arcane Resistance" }] }
      ],
      hiddenUntilUnlocked: false,
      completionReward: { type: "guild_arcane_resistance_pct", value: 8, description: "+8% Arcane Resistance (completion bonus)" }
    },
    {
      id: "spellweaving",
      branchId: "arcane",
      label: "Spellweaving",
      description: "The art of layering multiple spells to amplify arcane power.",
      iconKey: "node_spellweaving",
      position: { x: 130, y: 585 },
      prerequisites: [{ nodeId: "arcane_basics", minLevel: 3 }],
      maxLevel: 4,
      levels: [
        { level: 1, ducatCost: 10000, rewards: [{ type: "guild_combat_power_pct", value: 2, description: "+2% Combat Power" }] },
        { level: 2, ducatCost: 18000, rewards: [{ type: "guild_combat_power_pct", value: 2, description: "+2% Combat Power" }] },
        { level: 3, ducatCost: 28000, rewards: [{ type: "guild_combat_power_pct", value: 3, description: "+3% Combat Power" }] },
        { level: 4, ducatCost: 40000, rewards: [{ type: "guild_combat_power_pct", value: 3, description: "+3% Combat Power" }] }
      ],
      hiddenUntilUnlocked: false,
      completionReward: { type: "guild_combat_power_pct", value: 8, description: "+8% Combat Power (completion bonus)" }
    },
    {
      id: "high_sorcery",
      branchId: "arcane",
      label: "High Sorcery",
      description: "The pinnacle of arcane mastery — only attained by guilds who have walked both paths.",
      iconKey: "node_high_sorcery",
      position: { x: 10, y: 500 },
      prerequisites: [
        { nodeId: "runic_shields", minLevel: 4 },
        { nodeId: "spellweaving",  minLevel: 4 }
      ],
      maxLevel: 3,
      levels: [
        { level: 1, ducatCost: 50000,  rewards: [{ type: "guild_arcane_resistance_pct", value: 5, description: "+5% Arcane Resistance" }] },
        { level: 2, ducatCost: 80000,  rewards: [{ type: "guild_arcane_resistance_pct", value: 5, description: "+5% Arcane Resistance" }] },
        { level: 3, ducatCost: 120000, rewards: [{ type: "guild_arcane_resistance_pct", value: 10, description: "+10% Arcane Resistance" }] }
      ],
      hiddenUntilUnlocked: true,
      completionReward: { type: "guild_arcane_resistance_pct", value: 15, description: "+15% Arcane Resistance (completion bonus)" }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // GUILD BRANCH  ↑  branches upward from centre
    // ═══════════════════════════════════════════════════════════════════════
    {
      id: "guild_hall",
      branchId: "guild",
      label: "Guild Hall Expansion",
      description: "Renovate the guild hall to accommodate more members and resources.",
      iconKey: "node_guild_hall",
      position: { x: 500, y: 300 },
      prerequisites: [{ nodeId: "academy_core", minLevel: 1 }],
      maxLevel: 5,
      levels: [
        { level: 1, ducatCost: 6000,  rewards: [{ type: "guild_max_members", value: 2, description: "+2 Max Members" }] },
        { level: 2, ducatCost: 10000, rewards: [{ type: "guild_max_members", value: 2, description: "+2 Max Members" }] },
        { level: 3, ducatCost: 16000, rewards: [{ type: "guild_max_members", value: 3, description: "+3 Max Members" }] },
        { level: 4, ducatCost: 25000, rewards: [{ type: "guild_max_members", value: 3, description: "+3 Max Members" }] },
        { level: 5, ducatCost: 40000, rewards: [{ type: "guild_max_members", value: 5, description: "+5 Max Members" }] }
      ],
      hiddenUntilUnlocked: false,
      completionReward: { type: "guild_max_members", value: 5, description: "+5 Max Members (completion bonus)" }
    },
    {
      id: "war_council",
      branchId: "guild",
      label: "War Council",
      description: "A formal council of officers that coordinates guild strategy and rewards veterans.",
      iconKey: "node_war_council",
      position: { x: 375, y: 150 },
      prerequisites: [{ nodeId: "guild_hall", minLevel: 2 }],
      maxLevel: 3,
      levels: [
        { level: 1, ducatCost: 15000, rewards: [{ type: "member_xp_gain_pct", value: 3, description: "+3% XP Gain" }] },
        { level: 2, ducatCost: 25000, rewards: [{ type: "member_xp_gain_pct", value: 3, description: "+3% XP Gain" }] },
        { level: 3, ducatCost: 40000, rewards: [{ type: "member_xp_gain_pct", value: 5, description: "+5% XP Gain" }] }
      ],
      hiddenUntilUnlocked: false,
      completionReward: { type: "member_xp_gain_pct", value: 5, description: "+5% XP Gain (completion bonus)" }
    },
    {
      id: "alliance_pact",
      branchId: "guild",
      label: "Alliance Pact",
      description: "Formalise relationships with allied guilds to share resources and intelligence.",
      iconKey: "node_alliance_pact",
      position: { x: 625, y: 150 },
      prerequisites: [{ nodeId: "guild_hall", minLevel: 2 }],
      maxLevel: 3,
      levels: [
        { level: 1, ducatCost: 15000, rewards: [{ type: "guild_ducat_find_pct", value: 3, description: "+3% Ducat Find" }] },
        { level: 2, ducatCost: 25000, rewards: [{ type: "guild_ducat_find_pct", value: 3, description: "+3% Ducat Find" }] },
        { level: 3, ducatCost: 40000, rewards: [{ type: "guild_ducat_find_pct", value: 5, description: "+5% Ducat Find" }] }
      ],
      hiddenUntilUnlocked: false,
      completionReward: { type: "guild_ducat_find_pct", value: 5, description: "+5% Ducat Find (completion bonus)" }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // COMMERCE BRANCH  ↓  branches downward from centre
    // ═══════════════════════════════════════════════════════════════════════
    {
      id: "merchant_ties",
      branchId: "commerce",
      label: "Merchant Ties",
      description: "Establish relationships with merchant guilds to increase wealth flow.",
      iconKey: "node_merchant_ties",
      position: { x: 500, y: 700 },
      prerequisites: [{ nodeId: "academy_core", minLevel: 1 }],
      maxLevel: 5,
      levels: [
        { level: 1, ducatCost: 5000,  rewards: [{ type: "guild_ducat_find_pct", value: 1, description: "+1% Ducat Find" }] },
        { level: 2, ducatCost: 8000,  rewards: [{ type: "guild_ducat_find_pct", value: 1, description: "+1% Ducat Find" }] },
        { level: 3, ducatCost: 12000, rewards: [{ type: "guild_ducat_find_pct", value: 1, description: "+1% Ducat Find" }] },
        { level: 4, ducatCost: 20000, rewards: [{ type: "guild_ducat_find_pct", value: 1, description: "+1% Ducat Find" }] },
        { level: 5, ducatCost: 30000, rewards: [{ type: "guild_ducat_find_pct", value: 2, description: "+2% Ducat Find" }] }
      ],
      hiddenUntilUnlocked: false,
      completionReward: { type: "guild_ducat_find_pct", value: 5, description: "+5% Ducat Find (completion bonus)" }
    },
    {
      id: "trade_routes",
      branchId: "commerce",
      label: "Trade Routes",
      description: "Secure trade routes that generate steady income for all guild members.",
      iconKey: "node_trade_routes",
      position: { x: 375, y: 850 },
      prerequisites: [{ nodeId: "merchant_ties", minLevel: 2 }],
      maxLevel: 3,
      levels: [
        { level: 1, ducatCost: 12000, rewards: [{ type: "guild_ducat_find_pct", value: 3, description: "+3% Ducat Find" }] },
        { level: 2, ducatCost: 22000, rewards: [{ type: "guild_ducat_find_pct", value: 3, description: "+3% Ducat Find" }] },
        { level: 3, ducatCost: 35000, rewards: [{ type: "guild_ducat_find_pct", value: 5, description: "+5% Ducat Find" }] }
      ],
      hiddenUntilUnlocked: false,
      completionReward: { type: "guild_ducat_find_pct", value: 5, description: "+5% Ducat Find (completion bonus)" }
    },
    {
      id: "royal_charter",
      branchId: "commerce",
      label: "Royal Charter",
      description: "Obtain royal patronage that dramatically increases item find for all members.",
      iconKey: "node_royal_charter",
      position: { x: 625, y: 850 },
      prerequisites: [{ nodeId: "merchant_ties", minLevel: 2 }],
      maxLevel: 3,
      levels: [
        { level: 1, ducatCost: 12000, rewards: [{ type: "member_item_find_pct", value: 3, description: "+3% Item Find" }] },
        { level: 2, ducatCost: 22000, rewards: [{ type: "member_item_find_pct", value: 3, description: "+3% Item Find" }] },
        { level: 3, ducatCost: 35000, rewards: [{ type: "member_item_find_pct", value: 5, description: "+5% Item Find" }] }
      ],
      hiddenUntilUnlocked: false,
      completionReward: { type: "member_item_find_pct", value: 5, description: "+5% Item Find (completion bonus)" }
    }
  ]
};
