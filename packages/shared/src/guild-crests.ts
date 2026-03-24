const GUILD_CREST_TITLES = [
  ["crest_0", "Boar Bastion"],
  ["crest_1", "Mireglass Ward"],
  ["crest_2", "Ash Oak Ledger"],
  ["crest_3", "Red Pike Brotherhood"],
  ["crest_4", "Thornwake Line"],
  ["crest_5", "Pikecrown Ward"],
  ["crest_6", "Gullhook Salvors"],
  ["crest_7", "Rainwillow Circle"],
  ["crest_8", "River Spear Toll"],
  ["crest_9", "Heron Trail Accord"],
  ["crest_10", "Ash Thorn Company"],
  ["crest_11", "Bellroot Covenant"],
  ["crest_12", "Grey Shield Company"],
  ["crest_13", "Pikewake Brotherhood"],
  ["crest_14", "Iron Stag Watch"],
  ["crest_15", "Red Sabre House"],
  ["crest_16", "Black Boar Line"],
  ["crest_17", "Gate Ward"],
  ["crest_18", "Wolf Pennon Company"],
  ["crest_19", "Macehold Brotherhood"]
] as const;

export const GUILD_CREST_CATALOG = GUILD_CREST_TITLES.map(([id, title]) => ({
  id,
  title,
  assetPath: `/assets/items/generated/guild/${id}.png`
})) as readonly {
  id: (typeof GUILD_CREST_TITLES)[number][0];
  title: (typeof GUILD_CREST_TITLES)[number][1];
  assetPath: `/assets/items/generated/guild/${(typeof GUILD_CREST_TITLES)[number][0]}.png`;
}[];

export type GuildCrestCatalogEntry = (typeof GUILD_CREST_CATALOG)[number];

export const DEFAULT_GUILD_CREST_ID: GuildCrestCatalogEntry["id"] = GUILD_CREST_CATALOG[0].id;

export function getGuildCrestById(crestId: string | null | undefined): GuildCrestCatalogEntry {
  return GUILD_CREST_CATALOG.find((crest) => crest.id === crestId) ?? GUILD_CREST_CATALOG[0];
}
