import type { ReactElement } from "react";

import i18n from "../i18n";

export type LandingTab =
  | "inventory"
  | "messages"
  | "encyclopedia"
  | "contracts"
  | "missions"
  | "arena"
  | "jobs"
  | "guild"
  | "castles"
  | "auctionHouse"
  | "merchant"
  | "shop"
  | "garden"
  | "refinery"
  | "crafting"
  | "forge"
  | "leaderboards"
  | "settings";
export type MenuGroupId = "profile" | "adventures" | "market" | "estate" | "realm";
export type MenuGroup = {
  id: MenuGroupId;
  iconTab: LandingTab;
  tabs: LandingTab[];
};

export type LayoutMode = "compact" | "standard" | "wide";
export type CharacterHubTab = "character" | "renown" | "ledger" | "encyclopedia";
export type ProfileSideTab = "inventory" | "consumables" | "materials" | "stats";
export type ChatChannel = "world" | "guild";

export const CHAT_CHANNEL_LABEL_KEYS: Record<ChatChannel, string> = {
  world: "chat.world",
  guild: "chat.guild"
};

export const MENU_GROUPS: MenuGroup[] = [
  {
    id: "profile",
    iconTab: "inventory",
    tabs: ["inventory", "leaderboards", "settings"]
  },
  {
    id: "adventures",
    iconTab: "missions",
    tabs: ["contracts", "jobs", "arena"]
  },
  {
    id: "market",
    iconTab: "merchant",
    tabs: ["merchant", "auctionHouse", "shop"]
  },
  {
    id: "estate",
    iconTab: "garden",
    tabs: ["garden", "refinery", "forge"]
  },
  {
    id: "realm",
    iconTab: "guild",
    tabs: ["guild", "missions", "castles"]
  }
];

const MENU_GROUP_BY_TAB: Record<LandingTab, MenuGroupId> = {
  inventory: "profile",
  messages: "profile",
  encyclopedia: "profile",
  leaderboards: "profile",
  settings: "profile",
  contracts: "adventures",
  missions: "realm",
  arena: "adventures",
  jobs: "adventures",
  merchant: "market",
  auctionHouse: "market",
  shop: "market",
  garden: "estate",
  refinery: "estate",
  crafting: "estate",
  forge: "estate",
  guild: "realm",
  castles: "realm"
};

export function getLayoutMode(viewportWidth: number): LayoutMode {
  if (viewportWidth < 960) {
    return "compact";
  }
  if (viewportWidth >= 1400) {
    return "wide";
  }
  return "standard";
}

export function renderMenuIcon(tab: LandingTab): ReactElement | null {
  const iconProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.1,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };

  switch (tab) {
    case "inventory":
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="8" r="3" />
          <path d="M5.5 20c1.8-3.3 4.2-5 6.5-5s4.7 1.7 6.5 5" />
        </svg>
      );
    case "messages":
      return (
        <svg {...iconProps}>
          <path d="M4 7h16v10H4z" />
          <path d="m5 8 7 5 7-5" />
          <path d="M8 5h8" />
        </svg>
      );
    case "encyclopedia":
      return (
        <svg {...iconProps}>
          <path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 0-2 2V4z" />
          <path d="M7 8h8M7 12h8M7 16h6" />
        </svg>
      );
    case "contracts":
      return (
        <svg {...iconProps}>
          <path d="M7 4h10v16H7z" />
          <path d="M10 8h4M9.5 12h5M9.5 15h3" />
          <circle cx="16" cy="17" r="2" />
        </svg>
      );
    case "missions":
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="8" />
          <path d="m12 8 3 3-3 5-3-3z" />
        </svg>
      );
    case "arena":
      return (
        <svg {...iconProps}>
          <path d="m8 5 3 3-5 5-2 1 1-2 5-5" />
          <path d="m16 5-3 3 5 5 2 1-1-2-5-5" />
          <path d="M9 19h6" />
        </svg>
      );
    case "jobs":
      return (
        <svg {...iconProps}>
          <path d="m5 19 6-6" />
          <path d="m9 5 10 10" />
          <path d="m14 4 6 6-2 2-6-6z" />
          <path d="M4 20h5" />
        </svg>
      );
    case "guild":
      return (
        <svg {...iconProps}>
          <path d="M12 3L4 7v5c0 5 3 9 8 11 5-2 8-6 8-11V7l-8-4z" />
          <path d="M12 8v8M9 11l3-3 3 3" />
        </svg>
      );
    case "castles":
      return (
        <svg {...iconProps}>
          <path d="M5 20h14V8h-2V5h-2v3h-2V5h-2v3H9V5H7v3H5z" />
          <path d="M11 20v-4h2v4" />
        </svg>
      );
    case "auctionHouse":
      return (
        <svg {...iconProps}>
          <circle cx="9" cy="9" r="3" />
          <path d="m13 13 6 6M15 10l3-3 2 2-3 3z" />
        </svg>
      );
    case "merchant":
      return (
        <svg {...iconProps}>
          <path d="M12 6v12M8 6h8M5 10h6l-3 4zM13 10h6l-3 4zM8 20h8" />
        </svg>
      );
    case "shop":
      return (
        <svg {...iconProps}>
          <path d="M3 9h18M5 9v10h14V9M9 9V6h6v3M12 13v4" />
          <circle cx="9" cy="16" r="0.5" fill="currentColor" />
          <circle cx="15" cy="16" r="0.5" fill="currentColor" />
        </svg>
      );
    case "garden":
      return (
        <svg {...iconProps}>
          <path d="M12 20v-7" />
          <path d="M12 13c0-3.3 2.4-6 5.5-6-.2 3.3-2.4 6-5.5 6Z" />
          <path d="M12 10c0-2.7-2-5-4.8-5 .1 2.8 2.1 5 4.8 5Z" />
          <path d="M7 20h10" />
        </svg>
      );
    case "refinery":
      return (
        <svg {...iconProps}>
          <path d="M6 18h12" />
          <path d="M8 18V9l2-3h4l2 3v9" />
          <path d="M9 12h6" />
          <path d="M10 4h4" />
        </svg>
      );
    case "crafting":
      return (
        <svg {...iconProps}>
          <path d="M5 18h14" />
          <path d="m8 14 2 2 6-6" />
          <path d="M9 6h6l1 3H8z" />
          <path d="M12 6V3" />
        </svg>
      );
    case "forge":
      return (
        <svg {...iconProps}>
          <path d="M6 18h12" />
          <path d="M8 18v-4h8v4" />
          <path d="M10 6h4l1 4H9z" />
          <path d="M12 6V3" />
        </svg>
      );
    case "leaderboards":
      return (
        <svg {...iconProps}>
          <path d="M6 19V11M12 19V8M18 19V13M4 19h16" />
          <path d="M7 6c-1 1-2 3-2 5M17 6c1 1 2 3 2 5" />
        </svg>
      );
    case "settings":
      return (
        <svg {...iconProps}>
          <path d="M12 3 14 6 18 6 19 10 22 12 19 14 18 18 14 18 12 21 10 18 6 18 5 14 2 12 5 10 6 6 10 6z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );
    default:
      return null;
  }
}

export function formatMenuLabel(tab: LandingTab): string {
  if (tab === "inventory") {
    return "Character";
  }
  if (tab === "guild") {
    return i18n.t("menu.guildHall");
  }
  return i18n.t(`menu.${tab}`);
}

export function formatMenuGroupLabel(groupId: MenuGroupId): string {
  return i18n.t(`menuGroups.${groupId}`);
}

export function getMenuGroupForTab(tab: LandingTab): MenuGroupId {
  return MENU_GROUP_BY_TAB[tab];
}

export function formatCharacterHubTabLabel(tab: CharacterHubTab): string {
  switch (tab) {
    case "character":
      return "Character";
    case "renown":
      return "Renown";
    case "ledger":
      return "Ledger";
    case "encyclopedia":
      return "Encyclopedia";
    default:
      return tab;
  }
}

export function formatChatChannelLabel(channel: ChatChannel): string {
  return i18n.t(CHAT_CHANNEL_LABEL_KEYS[channel]);
}
