import type { AcademyTreeConfig } from "@ebonkeep/shared/guild";

export const ACADEMY_TREE_CONFIG: AcademyTreeConfig = {
  version: 5,
  centerNodeId: "academy_core",
  branches: [
    {
      id: "core",
      label: "Academy Core",
      description: "The central charter that lets a guild formalize research and doctrine.",
      iconKey: "branch_core",
      color: "#c59a4d"
    },
    {
      id: "general",
      label: "Guild Commons",
      description: "Broad guild utility focused on recovery, upkeep, and dependable day-to-day support.",
      iconKey: "branch_general",
      color: "#5d9988",
      completionReward: {
        type: "contract_xp_percent",
        value: 2,
        description: "+2% contract XP for fully mastering Guild Commons"
      }
    },
    {
      id: "expedition",
      label: "Expedition Office",
      description: "Scouting, chartering, and dispatch discipline that keeps the contract board richer and busier.",
      iconKey: "branch_expedition",
      color: "#809a46",
      completionReward: {
        type: "contract_item_drop_bps",
        value: 40,
        description: "+0.40% contract item drop chance for fully mastering Expedition Office"
      }
    },
    {
      id: "strength",
      label: "Strength Doctrine",
      description: "Training for frontline bruisers, shieldbearers, and heavy skirmishers.",
      iconKey: "branch_strength",
      color: "#a64f3a",
      completionReward: {
        type: "armor_flat",
        value: 2,
        description: "+2 armor for all guild members when the Strength branch is complete"
      }
    },
    {
      id: "intelligence",
      label: "Intelligence Doctrine",
      description: "Scholarly wards, arcane discipline, and defensive casting fundamentals.",
      iconKey: "branch_intelligence",
      color: "#497cb6",
      completionReward: {
        type: "spell_shield_flat",
        value: 2,
        description: "+2 spell shield for all guild members when the Intelligence branch is complete"
      }
    },
    {
      id: "dexterity",
      label: "Dexterity Doctrine",
      description: "Scouting, precision, and evasive movement for agile combatants.",
      iconKey: "branch_dexterity",
      color: "#3b8f6c",
      completionReward: {
        type: "accuracy_flat",
        value: 2,
        description: "+2 accuracy for all guild members when the Dexterity branch is complete"
      }
    },
    {
      id: "warfare",
      label: "War Games",
      description: "Duel culture, mock brackets, and coaching that improve the guild's arena routines.",
      iconKey: "branch_warfare",
      color: "#b26f3f",
      completionReward: {
        type: "arena_cooldown_percent",
        value: 3,
        description: "-3% arena refresh cooldown for fully mastering War Games"
      }
    }
  ],
  nodes: [
    {
      id: "academy_core",
      branchId: "core",
      label: "Founding Charter",
      description: "Establish the guild academy and unlock every major doctrine branch.",
      iconKey: "node_academy_core",
      position: { x: 700, y: 700 },
      prerequisites: [],
      maxLevel: 1,
      levels: [
        {
          level: 1,
          ducatCost: 18000,
          rewards: [
            {
              type: "contract_xp_percent",
              value: 1,
              description: "+1% contract XP"
            }
          ]
        }
      ],
      hiddenUntilUnlocked: false
    },
    {
      id: "shared_barracks",
      branchId: "general",
      label: "Shared Barracks",
      description: "Better common facilities help everyone recover stamina a little faster between outings.",
      iconKey: "node_shared_barracks",
      position: { x: 692, y: 466 },
      prerequisites: [{ nodeId: "academy_core", minLevel: 1 }],
      maxLevel: 3,
      levels: [
        { level: 1, ducatCost: 4500, rewards: [{ type: "stamina_regen_percent", value: 1, description: "+1% stamina regeneration" }] },
        { level: 2, ducatCost: 7000, rewards: [{ type: "stamina_regen_percent", value: 1, description: "+1% stamina regeneration" }] },
        { level: 3, ducatCost: 10000, rewards: [{ type: "stamina_regen_percent", value: 1, description: "+1% stamina regeneration" }] }
      ],
      hiddenUntilUnlocked: false
    },
    {
      id: "field_rations",
      branchId: "general",
      label: "Field Rations",
      description: "Cheaper restocking and recovery reduce the cost of patching up after a rough contract.",
      iconKey: "node_field_rations",
      position: { x: 492, y: 214 },
      prerequisites: [{ nodeId: "shared_barracks", minLevel: 3 }],
      maxLevel: 3,
      levels: [
        { level: 1, ducatCost: 6500, rewards: [{ type: "rest_cost_percent", value: 1, description: "-1% rest cost" }] },
        { level: 2, ducatCost: 9500, rewards: [{ type: "rest_cost_percent", value: 1, description: "-1% rest cost" }] },
        { level: 3, ducatCost: 13000, rewards: [{ type: "rest_cost_percent", value: 2, description: "-2% rest cost" }] }
      ],
      hiddenUntilUnlocked: false
    },
    {
      id: "contract_ledgers",
      branchId: "general",
      label: "Contract Ledgers",
      description: "Bookkeeping and routing discipline squeeze a little more value from every contract payout.",
      iconKey: "node_contract_ledgers",
      position: { x: 906, y: 246 },
      prerequisites: [{ nodeId: "shared_barracks", minLevel: 3 }],
      maxLevel: 4,
      levels: [
        { level: 1, ducatCost: 6500, rewards: [{ type: "contract_ducats_percent", value: 1, description: "+1% contract ducats" }] },
        { level: 2, ducatCost: 9500, rewards: [{ type: "contract_ducats_percent", value: 1, description: "+1% contract ducats" }] },
        { level: 3, ducatCost: 13000, rewards: [{ type: "contract_ducats_percent", value: 1, description: "+1% contract ducats" }] },
        { level: 4, ducatCost: 18000, rewards: [{ type: "contract_ducats_percent", value: 2, description: "+2% contract ducats" }] }
      ],
      hiddenUntilUnlocked: false
    },
    {
      id: "commonwealth_hall",
      branchId: "general",
      label: "Commonwealth Hall",
      description: "When the commons are fully organized, the whole guild benefits from steadier recovery and stronger reserves.",
      iconKey: "node_commonwealth_hall",
      position: { x: 728, y: 58 },
      prerequisites: [
        { nodeId: "field_rations", minLevel: 3 },
        { nodeId: "contract_ledgers", minLevel: 4 }
      ],
      maxLevel: 1,
      levels: [
        {
          level: 1,
          ducatCost: 42000,
          rewards: [
            { type: "stamina_regen_percent", value: 2, description: "+2% stamina regeneration" },
            { type: "rest_cost_percent", value: 2, description: "-2% rest cost" },
            { type: "max_members_flat", value: 1, description: "+1 guild member capacity" }
          ]
        }
      ],
      hiddenUntilUnlocked: false
    },
    {
      id: "dispatch_desk",
      branchId: "expedition",
      label: "Dispatch Desk",
      description: "Dedicated dispatchers keep contracts moving and squeeze a little more experience out of each outing.",
      iconKey: "node_dispatch_desk",
      position: { x: 452, y: 542 },
      prerequisites: [{ nodeId: "academy_core", minLevel: 1 }],
      maxLevel: 3,
      levels: [
        { level: 1, ducatCost: 5000, rewards: [{ type: "contract_xp_percent", value: 1, description: "+1% contract XP" }] },
        { level: 2, ducatCost: 8000, rewards: [{ type: "contract_xp_percent", value: 1, description: "+1% contract XP" }] },
        { level: 3, ducatCost: 11500, rewards: [{ type: "contract_xp_percent", value: 1, description: "+1% contract XP" }] }
      ],
      hiddenUntilUnlocked: false
    },
    {
      id: "trail_markers",
      branchId: "expedition",
      label: "Trail Markers",
      description: "Better routing notes and marker crews shave time off the board's replenishment cycle.",
      iconKey: "node_trail_markers",
      position: { x: 120, y: 382 },
      prerequisites: [{ nodeId: "dispatch_desk", minLevel: 3 }],
      maxLevel: 3,
      levels: [
        { level: 1, ducatCost: 8500, rewards: [{ type: "contract_replenish_percent", value: 3, description: "-3% contract replenishment time" }] },
        { level: 2, ducatCost: 12500, rewards: [{ type: "contract_replenish_percent", value: 3, description: "-3% contract replenishment time" }] },
        { level: 3, ducatCost: 17000, rewards: [{ type: "contract_replenish_percent", value: 4, description: "-4% contract replenishment time" }] }
      ],
      hiddenUntilUnlocked: false
    },
    {
      id: "bounty_brokers",
      branchId: "expedition",
      label: "Bounty Brokers",
      description: "Trusted brokers help the guild steer toward contracts with slightly richer spoils.",
      iconKey: "node_bounty_brokers",
      position: { x: 156, y: 612 },
      prerequisites: [{ nodeId: "dispatch_desk", minLevel: 3 }],
      maxLevel: 3,
      levels: [
        { level: 1, ducatCost: 8500, rewards: [{ type: "contract_item_drop_bps", value: 20, description: "+0.20% contract item drop chance" }] },
        { level: 2, ducatCost: 12500, rewards: [{ type: "contract_item_drop_bps", value: 20, description: "+0.20% contract item drop chance" }] },
        { level: 3, ducatCost: 17000, rewards: [{ type: "contract_item_drop_bps", value: 30, description: "+0.30% contract item drop chance" }] }
      ],
      hiddenUntilUnlocked: false
    },
    {
      id: "grand_charters",
      branchId: "expedition",
      label: "Grand Charters",
      description: "Master charter clerks secure a final permanent posting on the board, opening one more serious expedition line for the guild.",
      iconKey: "node_grand_charters",
      position: { x: 28, y: 500 },
      prerequisites: [
        { nodeId: "trail_markers", minLevel: 3 },
        { nodeId: "bounty_brokers", minLevel: 3 }
      ],
      maxLevel: 1,
      levels: [
        {
          level: 1,
          ducatCost: 42000,
          rewards: [
            { type: "contract_slot_count_flat", value: 1, description: "+1 contract board option" },
            { type: "contract_xp_percent", value: 2, description: "+2% contract XP" }
          ]
        }
      ],
      hiddenUntilUnlocked: false
    },
    {
      id: "drill_square",
      branchId: "strength",
      label: "Drill Square",
      description: "Daily formation work adds a modest strength edge for every guild member.",
      iconKey: "node_drill_square",
      position: { x: 962, y: 540 },
      prerequisites: [{ nodeId: "academy_core", minLevel: 1 }],
      maxLevel: 3,
      levels: [
        { level: 1, ducatCost: 5000, rewards: [{ type: "strength_flat", value: 1, description: "+1 strength" }] },
        { level: 2, ducatCost: 8000, rewards: [{ type: "strength_flat", value: 1, description: "+1 strength" }] },
        { level: 3, ducatCost: 11500, rewards: [{ type: "strength_flat", value: 1, description: "+1 strength" }] }
      ],
      hiddenUntilUnlocked: false
    },
    {
      id: "plated_forms",
      branchId: "strength",
      label: "Plated Forms",
      description: "Heavy sparring and weight discipline teach members how to fight through armor.",
      iconKey: "node_plated_forms",
      position: { x: 1276, y: 380 },
      prerequisites: [{ nodeId: "drill_square", minLevel: 3 }],
      maxLevel: 3,
      levels: [
        { level: 1, ducatCost: 8500, rewards: [{ type: "armor_flat", value: 2, description: "+2 armor" }] },
        { level: 2, ducatCost: 12500, rewards: [{ type: "armor_flat", value: 2, description: "+2 armor" }] },
        { level: 3, ducatCost: 17000, rewards: [{ type: "armor_flat", value: 3, description: "+3 armor" }] }
      ],
      hiddenUntilUnlocked: false
    },
    {
      id: "shield_wall",
      branchId: "strength",
      label: "Shield Wall",
      description: "Defensive drills teach members how to brace against brutal physical pressure.",
      iconKey: "node_shield_wall",
      position: { x: 1240, y: 614 },
      prerequisites: [{ nodeId: "drill_square", minLevel: 3 }],
      maxLevel: 3,
      levels: [
        { level: 1, ducatCost: 8500, rewards: [{ type: "physical_defense_flat", value: 1, description: "+1 physical defense" }] },
        { level: 2, ducatCost: 12500, rewards: [{ type: "physical_defense_flat", value: 1, description: "+1 physical defense" }] },
        { level: 3, ducatCost: 17000, rewards: [{ type: "physical_defense_flat", value: 2, description: "+2 physical defense" }] }
      ],
      hiddenUntilUnlocked: false
    },
    {
      id: "bulwark_standard",
      branchId: "strength",
      label: "Bulwark Standard",
      description: "The branch's final banner marks a fully disciplined frontline corps and grants a lasting edge to every bruiser in the guild.",
      iconKey: "node_bulwark_standard",
      position: { x: 1384, y: 496 },
      prerequisites: [
        { nodeId: "plated_forms", minLevel: 3 },
        { nodeId: "shield_wall", minLevel: 3 }
      ],
      maxLevel: 1,
      levels: [
        {
          level: 1,
          ducatCost: 42000,
          rewards: [
            { type: "strength_flat", value: 1, description: "+1 strength" },
            { type: "armor_flat", value: 2, description: "+2 armor" },
            { type: "physical_defense_flat", value: 1, description: "+1 physical defense" }
          ]
        }
      ],
      hiddenUntilUnlocked: false
    },
    {
      id: "scribe_hall",
      branchId: "intelligence",
      label: "Scribe Hall",
      description: "Shared notes, rune tables, and lecture halls lift every member's magical fundamentals.",
      iconKey: "node_scribe_hall",
      position: { x: 454, y: 878 },
      prerequisites: [{ nodeId: "academy_core", minLevel: 1 }],
      maxLevel: 3,
      levels: [
        { level: 1, ducatCost: 5000, rewards: [{ type: "intelligence_flat", value: 1, description: "+1 intelligence" }] },
        { level: 2, ducatCost: 8000, rewards: [{ type: "intelligence_flat", value: 1, description: "+1 intelligence" }] },
        { level: 3, ducatCost: 11500, rewards: [{ type: "intelligence_flat", value: 1, description: "+1 intelligence" }] }
      ],
      hiddenUntilUnlocked: false
    },
    {
      id: "ward_lattice",
      branchId: "intelligence",
      label: "Ward Lattice",
      description: "Layered warding patterns improve protection against spellfire and arcane pressure.",
      iconKey: "node_ward_lattice",
      position: { x: 134, y: 838 },
      prerequisites: [{ nodeId: "scribe_hall", minLevel: 3 }],
      maxLevel: 3,
      levels: [
        { level: 1, ducatCost: 8500, rewards: [{ type: "spell_shield_flat", value: 2, description: "+2 spell shield" }] },
        { level: 2, ducatCost: 12500, rewards: [{ type: "spell_shield_flat", value: 2, description: "+2 spell shield" }] },
        { level: 3, ducatCost: 17000, rewards: [{ type: "spell_shield_flat", value: 3, description: "+3 spell shield" }] }
      ],
      hiddenUntilUnlocked: false
    },
    {
      id: "null_wards",
      branchId: "intelligence",
      label: "Null Wards",
      description: "Counter-casting drills give members a little more resistance against magical punishment.",
      iconKey: "node_null_wards",
      position: { x: 182, y: 1048 },
      prerequisites: [{ nodeId: "scribe_hall", minLevel: 3 }],
      maxLevel: 3,
      levels: [
        { level: 1, ducatCost: 8500, rewards: [{ type: "magic_defense_flat", value: 1, description: "+1 magic defense" }] },
        { level: 2, ducatCost: 12500, rewards: [{ type: "magic_defense_flat", value: 1, description: "+1 magic defense" }] },
        { level: 3, ducatCost: 17000, rewards: [{ type: "magic_defense_flat", value: 2, description: "+2 magic defense" }] }
      ],
      hiddenUntilUnlocked: false
    },
    {
      id: "astral_sanctum",
      branchId: "intelligence",
      label: "Astral Sanctum",
      description: "The branch's final sanctum turns theory into permanent protection, rewarding every scholar and caster in the guild.",
      iconKey: "node_astral_sanctum",
      position: { x: 34, y: 934 },
      prerequisites: [
        { nodeId: "ward_lattice", minLevel: 3 },
        { nodeId: "null_wards", minLevel: 3 }
      ],
      maxLevel: 1,
      levels: [
        {
          level: 1,
          ducatCost: 42000,
          rewards: [
            { type: "intelligence_flat", value: 1, description: "+1 intelligence" },
            { type: "spell_shield_flat", value: 2, description: "+2 spell shield" },
            { type: "magic_defense_flat", value: 1, description: "+1 magic defense" }
          ]
        }
      ],
      hiddenUntilUnlocked: false
    },
    {
      id: "scout_post",
      branchId: "dexterity",
      label: "Scout Post",
      description: "Routine drills in tracking and movement add a small dexterity bump across the guild.",
      iconKey: "node_scout_post",
      position: { x: 962, y: 878 },
      prerequisites: [{ nodeId: "academy_core", minLevel: 1 }],
      maxLevel: 3,
      levels: [
        { level: 1, ducatCost: 5000, rewards: [{ type: "dexterity_flat", value: 1, description: "+1 dexterity" }] },
        { level: 2, ducatCost: 8000, rewards: [{ type: "dexterity_flat", value: 1, description: "+1 dexterity" }] },
        { level: 3, ducatCost: 11500, rewards: [{ type: "dexterity_flat", value: 1, description: "+1 dexterity" }] }
      ],
      hiddenUntilUnlocked: false
    },
    {
      id: "sightline_calibration",
      branchId: "dexterity",
      label: "Sightline Calibration",
      description: "Range work and spotting practice help members land their hits more consistently.",
      iconKey: "node_sightline_calibration",
      position: { x: 1270, y: 850 },
      prerequisites: [{ nodeId: "scout_post", minLevel: 3 }],
      maxLevel: 3,
      levels: [
        { level: 1, ducatCost: 8500, rewards: [{ type: "accuracy_flat", value: 2, description: "+2 accuracy" }] },
        { level: 2, ducatCost: 12500, rewards: [{ type: "accuracy_flat", value: 2, description: "+2 accuracy" }] },
        { level: 3, ducatCost: 17000, rewards: [{ type: "accuracy_flat", value: 3, description: "+3 accuracy" }] }
      ],
      hiddenUntilUnlocked: false
    },
    {
      id: "evasive_routines",
      branchId: "dexterity",
      label: "Evasive Routines",
      description: "Footwork circuits teach members how to shave off the cleanest enemy hits.",
      iconKey: "node_evasive_routines",
      position: { x: 1292, y: 1046 },
      prerequisites: [{ nodeId: "scout_post", minLevel: 3 }],
      maxLevel: 3,
      levels: [
        { level: 1, ducatCost: 8500, rewards: [{ type: "dodge_chance_bps", value: 25, description: "+0.25% dodge chance" }] },
        { level: 2, ducatCost: 12500, rewards: [{ type: "dodge_chance_bps", value: 25, description: "+0.25% dodge chance" }] },
        { level: 3, ducatCost: 17000, rewards: [{ type: "dodge_chance_bps", value: 50, description: "+0.50% dodge chance" }] }
      ],
      hiddenUntilUnlocked: false
    },
    {
      id: "windwatch_spire",
      branchId: "dexterity",
      label: "Windwatch Spire",
      description: "The branch's final tower elevates the guild's scouts into true hunters, granting lasting precision and evasive finesse.",
      iconKey: "node_windwatch_spire",
      position: { x: 1398, y: 940 },
      prerequisites: [
        { nodeId: "sightline_calibration", minLevel: 3 },
        { nodeId: "evasive_routines", minLevel: 3 }
      ],
      maxLevel: 1,
      levels: [
        {
          level: 1,
          ducatCost: 42000,
          rewards: [
            { type: "dexterity_flat", value: 1, description: "+1 dexterity" },
            { type: "accuracy_flat", value: 2, description: "+2 accuracy" },
            { type: "dodge_chance_bps", value: 50, description: "+0.50% dodge chance" }
          ]
        }
      ],
      hiddenUntilUnlocked: false
    },
    {
      id: "sparring_rosters",
      branchId: "warfare",
      label: "Sparring Rosters",
      description: "Organized duel rosters make it easier for guild members to cycle fresh arena opportunities.",
      iconKey: "node_sparring_rosters",
      position: { x: 706, y: 986 },
      prerequisites: [{ nodeId: "academy_core", minLevel: 1 }],
      maxLevel: 3,
      levels: [
        { level: 1, ducatCost: 5000, rewards: [{ type: "arena_cooldown_percent", value: 3, description: "-3% arena refresh cooldown" }] },
        { level: 2, ducatCost: 8000, rewards: [{ type: "arena_cooldown_percent", value: 3, description: "-3% arena refresh cooldown" }] },
        { level: 3, ducatCost: 11500, rewards: [{ type: "arena_cooldown_percent", value: 4, description: "-4% arena refresh cooldown" }] }
      ],
      hiddenUntilUnlocked: false
    },
    {
      id: "duelist_ledgers",
      branchId: "warfare",
      label: "Duelist Ledgers",
      description: "Recorded match notes help members steal one more point of value from their arena wins.",
      iconKey: "node_duelist_ledgers",
      position: { x: 492, y: 1232 },
      prerequisites: [{ nodeId: "sparring_rosters", minLevel: 3 }],
      maxLevel: 3,
      levels: [
        { level: 1, ducatCost: 8500, rewards: [{ type: "arena_rating_win_flat", value: 1, description: "+1 arena rating on victory" }] },
        { level: 2, ducatCost: 12500, rewards: [{ type: "arena_rating_win_flat", value: 1, description: "+1 arena rating on victory" }] },
        { level: 3, ducatCost: 17000, rewards: [{ type: "arena_rating_win_flat", value: 1, description: "+1 arena rating on victory" }] }
      ],
      hiddenUntilUnlocked: false
    },
    {
      id: "spectator_rails",
      branchId: "warfare",
      label: "Spectator Rails",
      description: "Studied crowds and watching coaches help soften the sting of narrow arena losses.",
      iconKey: "node_spectator_rails",
      position: { x: 894, y: 1208 },
      prerequisites: [{ nodeId: "sparring_rosters", minLevel: 3 }],
      maxLevel: 3,
      levels: [
        { level: 1, ducatCost: 8500, rewards: [{ type: "arena_rating_loss_reduction_flat", value: 1, description: "-1 arena rating lost on defeat" }] },
        { level: 2, ducatCost: 12500, rewards: [{ type: "arena_rating_loss_reduction_flat", value: 1, description: "-1 arena rating lost on defeat" }] },
        { level: 3, ducatCost: 17000, rewards: [{ type: "arena_rating_loss_reduction_flat", value: 1, description: "-1 arena rating lost on defeat" }] }
      ],
      hiddenUntilUnlocked: false
    },
    {
      id: "victors_forum",
      branchId: "warfare",
      label: "Victor's Forum",
      description: "The branch's final forum secures one more elite duel opportunity and marks the guild as a serious arena house.",
      iconKey: "node_victors_forum",
      position: { x: 744, y: 1376 },
      prerequisites: [
        { nodeId: "duelist_ledgers", minLevel: 3 },
        { nodeId: "spectator_rails", minLevel: 3 }
      ],
      maxLevel: 1,
      levels: [
        {
          level: 1,
          ducatCost: 42000,
          rewards: [
            { type: "arena_offer_count_flat", value: 1, description: "+1 arena duel option" },
            { type: "arena_cooldown_percent", value: 3, description: "-3% arena refresh cooldown" }
          ]
        }
      ],
      hiddenUntilUnlocked: false
    }
  ]
};
