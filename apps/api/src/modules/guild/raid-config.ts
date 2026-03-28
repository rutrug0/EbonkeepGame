import {
  guildRaidBossDefinitionSchema,
  type GuildRaidBossDefinition
} from "@ebonkeep/shared/guild";

export const GUILD_RAID_LABEL = "Guild Raid Bosses";
export const GUILD_RAID_DEFAULT_LOBBY_HOURS = 24;
export const GUILD_RAID_DEFAULT_LOCK_HOURS = 24;

const SNAGTOOTH_PORTRAIT_ASSET_PATH =
  "/assets/raid_bosses/snagtooth_packlord.png";
const MIREPOOL_PORTRAIT_ASSET_PATH =
  "/assets/raid_bosses/mireglass_hydra.png";
const GRAVEWARD_PORTRAIT_ASSET_PATH =
  "/assets/raid_bosses/graveward_matriarch.png";
const CINDERHOLD_PORTRAIT_ASSET_PATH =
  "/assets/raid_bosses/cinderhold_bastion.png";
const SALTWAKE_PORTRAIT_ASSET_PATH =
  "/assets/raid_bosses/saltwake_leviathan.png";
const ASHEN_PORTRAIT_ASSET_PATH =
  "/assets/raid_bosses/ashen_regent.png";

export const GUILD_RAID_BOSS_CHAIN: readonly GuildRaidBossDefinition[] = [
  guildRaidBossDefinitionSchema.parse({
    id: "snagtooth-packlord",
    orderIndex: 0,
    zoneKey: "snagtooth_hollow",
    zoneName: "Snagtooth Hollow",
    bossName: "Snagtooth Packlord",
    bossTitle: "The First Howl",
    portraitAssetPath: SNAGTOOTH_PORTRAIT_ASSET_PATH,
    stageAssetPath: null,
    flavorText:
      "A scarred alpha that rallies every scavenger den in the hollow. The first guilds to break it establish the pace for everyone else.",
    recommendedGuildPower: 1_200,
    bossMaxHp: 22_800,
    minParticipants: 3,
    participantCap: 50,
    summonDucatsCost: 12_000,
    summonImperialsCost: 0,
    lobbyDurationHours: GUILD_RAID_DEFAULT_LOBBY_HOURS,
    lockDurationHours: GUILD_RAID_DEFAULT_LOCK_HOURS,
    unlockedBonus: {
      type: "contract_xp_percent",
      value: 10,
      label: "+10% Contract XP",
      description: "All guild members gain 10% more contract experience after the Packlord falls."
    }
  }),
  guildRaidBossDefinitionSchema.parse({
    id: "mireglass-hydra",
    orderIndex: 1,
    zoneKey: "mirepool_bog",
    zoneName: "Mirepool Bog",
    bossName: "Mireglass Hydra",
    bossTitle: "The Drowned Crown",
    portraitAssetPath: MIREPOOL_PORTRAIT_ASSET_PATH,
    stageAssetPath: null,
    flavorText:
      "Its heads regrow faster than the marsh can swallow them. A guild that wins here turns discipline into economic momentum.",
    recommendedGuildPower: 1_850,
    bossMaxHp: 37_500,
    minParticipants: 4,
    participantCap: 50,
    summonDucatsCost: 18_000,
    summonImperialsCost: 5,
    lobbyDurationHours: GUILD_RAID_DEFAULT_LOBBY_HOURS,
    lockDurationHours: GUILD_RAID_DEFAULT_LOCK_HOURS,
    unlockedBonus: {
      type: "contract_ducats_percent",
      value: 8,
      label: "+8% Contract Ducats",
      description: "Guild contracts pay 8% more ducats once the Mireglass Hydra is defeated."
    }
  }),
  guildRaidBossDefinitionSchema.parse({
    id: "graveward-matriarch",
    orderIndex: 2,
    zoneKey: "graveward_barrows",
    zoneName: "Graveward Barrows",
    bossName: "Graveward Matriarch",
    bossTitle: "Mistmother of the Cairns",
    portraitAssetPath: GRAVEWARD_PORTRAIT_ASSET_PATH,
    stageAssetPath: null,
    flavorText:
      "A sovereign revenant that binds entire burial fields to her will. Beating her sharpens the guild's hunt for rare drops.",
    recommendedGuildPower: 2_650,
    bossMaxHp: 55_900,
    minParticipants: 5,
    participantCap: 50,
    summonDucatsCost: 24_000,
    summonImperialsCost: 8,
    lobbyDurationHours: GUILD_RAID_DEFAULT_LOBBY_HOURS,
    lockDurationHours: GUILD_RAID_DEFAULT_LOCK_HOURS,
    unlockedBonus: {
      type: "contract_item_drop_bps",
      value: 250,
      label: "+2.5% Item Drop Rate",
      description: "All guild members gain 2.5% additional contract item drop chance after the Matriarch falls."
    }
  }),
  guildRaidBossDefinitionSchema.parse({
    id: "cinderhold-bastion",
    orderIndex: 3,
    zoneKey: "cinderhold_ridge",
    zoneName: "Cinderhold Ridge",
    bossName: "Cinderhold Bastion",
    bossTitle: "The Siege Engine That Walks",
    portraitAssetPath: CINDERHOLD_PORTRAIT_ASSET_PATH,
    stageAssetPath: null,
    flavorText:
      "An ancient furnace-knight wrapped in chains and slag. Clearing it speeds up the whole guild's daily pacing.",
    recommendedGuildPower: 3_800,
    bossMaxHp: 82_000,
    minParticipants: 6,
    participantCap: 50,
    summonDucatsCost: 32_000,
    summonImperialsCost: 12,
    lobbyDurationHours: GUILD_RAID_DEFAULT_LOBBY_HOURS,
    lockDurationHours: GUILD_RAID_DEFAULT_LOCK_HOURS,
    unlockedBonus: {
      type: "stamina_regen_percent",
      value: 8,
      label: "+8% Stamina Regen",
      description: "Guild members regenerate stamina 8% faster after the Bastion is brought down."
    }
  }),
  guildRaidBossDefinitionSchema.parse({
    id: "saltwake-leviathan",
    orderIndex: 4,
    zoneKey: "saltwake_shoals",
    zoneName: "Saltwake Shoals",
    bossName: "Saltwake Leviathan",
    bossTitle: "Breaker of Anchors",
    portraitAssetPath: SALTWAKE_PORTRAIT_ASSET_PATH,
    stageAssetPath: null,
    flavorText:
      "A tidal horror that drags whole flotillas under. If the guild can coordinate here, its board refresh cadence accelerates everywhere else.",
    recommendedGuildPower: 5_200,
    bossMaxHp: 114_400,
    minParticipants: 7,
    participantCap: 50,
    summonDucatsCost: 42_000,
    summonImperialsCost: 16,
    lobbyDurationHours: GUILD_RAID_DEFAULT_LOBBY_HOURS,
    lockDurationHours: GUILD_RAID_DEFAULT_LOCK_HOURS,
    unlockedBonus: {
      type: "contract_replenish_percent",
      value: 10,
      label: "-10% Contract Refresh Time",
      description: "Contract board replenishment becomes 10% faster for the whole guild after the Leviathan is slain."
    }
  }),
  guildRaidBossDefinitionSchema.parse({
    id: "ashen-regent",
    orderIndex: 5,
    zoneKey: "ashen_throne",
    zoneName: "Ashen Throne",
    bossName: "Ashen Regent",
    bossTitle: "The Last Claimant",
    portraitAssetPath: ASHEN_PORTRAIT_ASSET_PATH,
    stageAssetPath: null,
    flavorText:
      "A warlord preserved in ember and oath. This final kill is meant to feel like a guild-defining power spike, not a side activity.",
    recommendedGuildPower: 6_900,
    bossMaxHp: 152_000,
    minParticipants: 8,
    participantCap: 50,
    summonDucatsCost: 56_000,
    summonImperialsCost: 20,
    lobbyDurationHours: GUILD_RAID_DEFAULT_LOBBY_HOURS,
    lockDurationHours: GUILD_RAID_DEFAULT_LOCK_HOURS,
    unlockedBonus: {
      type: "armor_flat",
      value: 40,
      label: "+40 Armor",
      description: "Every guild member gains a permanent +40 armor after the Ashen Regent is conquered."
    }
  })
] as const;

export function getGuildRaidBossDefinition(orderIndex: number): GuildRaidBossDefinition | null {
  return GUILD_RAID_BOSS_CHAIN[orderIndex] ?? null;
}
