export const GUILD_CREST_CATALOG = [
  {
    id: "crest_0",
    title: "Boar Bastion",
    assetPath: "/assets/items/generated/guild/crest_0.png"
  },
  {
    id: "crest_1",
    title: "Mireglass Ward",
    assetPath: "/assets/items/generated/guild/crest_1.png"
  },
  {
    id: "crest_2",
    title: "Ash Oak Ledger",
    assetPath: "/assets/items/generated/guild/crest_2.png"
  },
  {
    id: "crest_3",
    title: "Red Pike Brotherhood",
    assetPath: "/assets/items/generated/guild/crest_3.png"
  },
  {
    id: "crest_4",
    title: "Thornwake Line",
    assetPath: "/assets/items/generated/guild/crest_4.png"
  }
] as const;

export type GuildCrestCatalogEntry = (typeof GUILD_CREST_CATALOG)[number];

export const DEFAULT_GUILD_CREST_ID: GuildCrestCatalogEntry["id"] = GUILD_CREST_CATALOG[0].id;

export function getGuildCrestById(crestId: string | null | undefined): GuildCrestCatalogEntry {
  return GUILD_CREST_CATALOG.find((crest) => crest.id === crestId) ?? GUILD_CREST_CATALOG[0];
}
