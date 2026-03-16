import type { MouseEventHandler, ReactElement, RefObject, WheelEventHandler } from "react";
import { useTranslation } from "react-i18next";

import type { RenownState } from "@ebonkeep/shared/player";

type RenownNodeStatus = "unlocked" | "available" | "locked";
type RenownBranchTone = "root" | "ledger" | "garden" | "campaign" | "industry";
type RenownIconKey =
  | "sigil"
  | "quill"
  | "sprout"
  | "banner"
  | "map"
  | "lantern"
  | "vial"
  | "satchel"
  | "route"
  | "hammer"
  | "archive"
  | "tower";
type RenownNode = {
  id: string;
  label: string;
  branch: string;
  tone: RenownBranchTone;
  icon: RenownIconKey;
  description: string;
  effect: string;
  requirements: string[];
  cost: number;
  tier: number;
  status: RenownNodeStatus;
  x: number;
  y: number;
};
type RenownEdge = {
  from: string;
  to: string;
};
type RenownCanopy = {
  id: string;
  tone: Exclude<RenownBranchTone, "root">;
  x: number;
  y: number;
  width: number;
  height: number;
  rotate: number;
};

export type RenownViewState = {
  x: number;
  y: number;
  scale: number;
};

export const DEFAULT_RENOWN_NODE_ID = "first_charter";
export const RENOWN_SCENE_WIDTH = 1260;
export const RENOWN_SCENE_HEIGHT = 1040;
export const RENOWN_MIN_SCALE = 0.62;
export const RENOWN_MAX_SCALE = 1.45;
export const RENOWN_INITIAL_VIEW: RenownViewState = {
  x: 62,
  y: -8,
  scale: 0.78
};

const RENOWN_CANOPIES: RenownCanopy[] = [
  {
    id: "ledger-canopy",
    tone: "ledger",
    x: 172,
    y: 132,
    width: 330,
    height: 230,
    rotate: -14
  },
  {
    id: "garden-canopy",
    tone: "garden",
    x: 440,
    y: 92,
    width: 360,
    height: 250,
    rotate: -4
  },
  {
    id: "campaign-canopy",
    tone: "campaign",
    x: 724,
    y: 132,
    width: 330,
    height: 230,
    rotate: 10
  },
  {
    id: "industry-canopy",
    tone: "industry",
    x: 882,
    y: 264,
    width: 236,
    height: 184,
    rotate: 16
  }
];

const RENOWN_NODES: RenownNode[] = [
  {
    id: "first_charter",
    label: "First Charter",
    branch: "Foundation",
    tone: "root",
    icon: "sigil",
    description:
      "The first charter anchors your account's standing beyond a single server life. Every later branch grows from this sworn record.",
    effect: "Establishes the Renown tree and preserves its passive unlocks across server resets.",
    requirements: [],
    cost: 0,
    tier: 0,
    status: "unlocked",
    x: 634,
    y: 904
  },
  {
    id: "ledger_quills",
    label: "Ledger Quills",
    branch: "Ledger",
    tone: "ledger",
    icon: "quill",
    description:
      "Field scribes keep cleaner first-contact notes, so the Ledger fills with fewer gaps when a new threat is met.",
    effect: "Newly discovered monster families begin with one recorded behavior already noted in the Ledger.",
    requirements: ["First Charter"],
    cost: 1,
    tier: 1,
    status: "unlocked",
    x: 464,
    y: 742
  },
  {
    id: "garden_patronage",
    label: "Garden Patronage",
    branch: "Garden",
    tone: "garden",
    icon: "sprout",
    description:
      "Steady patronage keeps beds fertile, water stores filled, and cuttings alive between campaigns.",
    effect:
      "Apothecary Garden plots mature slightly faster and suffer less minor yield loss from missed tending windows.",
    requirements: ["First Charter"],
    cost: 1,
    tier: 1,
    status: "unlocked",
    x: 634,
    y: 700
  },
  {
    id: "campaign_banners",
    label: "Campaign Banners",
    branch: "Campaign",
    tone: "campaign",
    icon: "banner",
    description:
      "March orders are standardized across campaigns, making preparation easier to carry from one server life into the next.",
    effect: "Contracts and mission prep systems gain small quality-of-life efficiency bonuses account-wide.",
    requirements: ["First Charter"],
    cost: 1,
    tier: 1,
    status: "available",
    x: 806,
    y: 742
  },
  {
    id: "surveyor_marks",
    label: "Surveyor Marks",
    branch: "Ledger",
    tone: "ledger",
    icon: "map",
    description:
      "Trail marks and watch-notes keep newly discovered zones better charted the first time they are breached.",
    effect: "The first discovered enemies in a newly revealed zone are added to the Ledger faster.",
    requirements: ["Ledger Quills"],
    cost: 2,
    tier: 2,
    status: "available",
    x: 360,
    y: 568
  },
  {
    id: "wardens_lantern",
    label: "Warden's Lantern",
    branch: "Ledger",
    tone: "ledger",
    icon: "lantern",
    description:
      "Watch-lantern protocols ensure scouting parties return with clearer accounts of what stalked them in the dark.",
    effect: "Ledger kill thresholds reveal their next milestone a little earlier for known monster families.",
    requirements: ["Ledger Quills"],
    cost: 2,
    tier: 2,
    status: "locked",
    x: 524,
    y: 520
  },
  {
    id: "stillroom_measures",
    label: "Stillroom Measures",
    branch: "Garden",
    tone: "garden",
    icon: "vial",
    description:
      "Stillroom measures are standardized, reducing waste and keeping every pressing or draught more predictable.",
    effect: "Stillroom crafting has a small chance to refund part of the ingredient cost on simple consumables.",
    requirements: ["Garden Patronage"],
    cost: 2,
    tier: 2,
    status: "available",
    x: 610,
    y: 482
  },
  {
    id: "seed_vaults",
    label: "Seed Vaults",
    branch: "Garden",
    tone: "garden",
    icon: "satchel",
    description:
      "Sealed stores keep rare cuttings viable longer, giving your apothecary work more reliable follow-through.",
    effect: "Rare and slow-growing seeds keep better condition while idle and lose less quality from delay.",
    requirements: ["Garden Patronage"],
    cost: 2,
    tier: 2,
    status: "locked",
    x: 748,
    y: 500
  },
  {
    id: "quartermaster_routes",
    label: "Quartermaster Routes",
    branch: "Campaign",
    tone: "campaign",
    icon: "route",
    description:
      "Known courier lanes and reserve depots make it easier to move supplies where future runs need them most.",
    effect: "Queued support systems recover and complete a little more efficiently during active play periods.",
    requirements: ["Campaign Banners"],
    cost: 2,
    tier: 2,
    status: "locked",
    x: 858,
    y: 560
  },
  {
    id: "tempering_clause",
    label: "Tempering Clause",
    branch: "Industry",
    tone: "industry",
    icon: "hammer",
    description:
      "Old forge clauses preserve safer routines for risky work, letting tempering hold together through one more bad pull.",
    effect: "Volatile Tempering gains a small stability floor before severe penalties begin.",
    requirements: ["Quartermaster Routes"],
    cost: 3,
    tier: 2,
    status: "locked",
    x: 984,
    y: 518
  },
  {
    id: "archive_ciphers",
    label: "Archive Ciphers",
    branch: "Ledger",
    tone: "ledger",
    icon: "archive",
    description:
      "Cross-server codebooks make old reports easier to read and connect, even when the names of places have changed.",
    effect: "Ledger pages preview one deeper milestone for already discovered families.",
    requirements: ["Surveyor Marks", "Warden's Lantern"],
    cost: 3,
    tier: 3,
    status: "locked",
    x: 284,
    y: 326
  },
  {
    id: "draught_reserve",
    label: "Draught Reserve",
    branch: "Garden",
    tone: "garden",
    icon: "tower",
    description:
      "A better reserve culture keeps stocks of finished tonics ready for the next hard run rather than the last one.",
    effect: "Selected consumable categories can hold slightly deeper reserve caps.",
    requirements: ["Stillroom Measures", "Seed Vaults"],
    cost: 3,
    tier: 3,
    status: "locked",
    x: 646,
    y: 274
  },
  {
    id: "veteran_dispatch",
    label: "Veteran Dispatch",
    branch: "Campaign",
    tone: "campaign",
    icon: "banner",
    description:
      "Veteran dispatch circles pass along the habits that let expeditions start faster and waste fewer supplies.",
    effect: "Preparation-heavy activities begin with a small long-tail efficiency bonus once unlocked.",
    requirements: ["Quartermaster Routes", "Tempering Clause"],
    cost: 3,
    tier: 3,
    status: "locked",
    x: 1044,
    y: 334
  }
];

const RENOWN_EDGES: RenownEdge[] = [
  { from: "first_charter", to: "ledger_quills" },
  { from: "first_charter", to: "garden_patronage" },
  { from: "first_charter", to: "campaign_banners" },
  { from: "ledger_quills", to: "surveyor_marks" },
  { from: "ledger_quills", to: "wardens_lantern" },
  { from: "garden_patronage", to: "stillroom_measures" },
  { from: "garden_patronage", to: "seed_vaults" },
  { from: "campaign_banners", to: "quartermaster_routes" },
  { from: "quartermaster_routes", to: "tempering_clause" },
  { from: "surveyor_marks", to: "archive_ciphers" },
  { from: "wardens_lantern", to: "archive_ciphers" },
  { from: "stillroom_measures", to: "draught_reserve" },
  { from: "seed_vaults", to: "draught_reserve" },
  { from: "quartermaster_routes", to: "veteran_dispatch" },
  { from: "tempering_clause", to: "veteran_dispatch" }
];

const RENOWN_NODE_BY_ID = new Map<string, RenownNode>(RENOWN_NODES.map((node) => [node.id, node]));
const RENOWN_NODE_LABEL_TO_ID = new Map<string, string>(RENOWN_NODES.map((node) => [node.label, node.id]));

function computeRenownNodeStatus(
  node: RenownNode,
  unlockedSet: ReadonlySet<string>
): RenownNodeStatus {
  if (unlockedSet.has(node.id)) return "unlocked";
  const prereqsMet = node.requirements.every((label) => {
    const prereqId = RENOWN_NODE_LABEL_TO_ID.get(label);
    return prereqId ? unlockedSet.has(prereqId) : false;
  });
  return prereqsMet ? "available" : "locked";
}

function buildRenownEdgePath(source: RenownNode, target: RenownNode): string {
  const controlYOffset = Math.max(54, Math.abs(source.y - target.y) * 0.38);
  return `M ${source.x} ${source.y} C ${source.x} ${source.y - controlYOffset}, ${target.x} ${
    target.y + controlYOffset
  }, ${target.x} ${target.y}`;
}

function renderRenownNodeGlyph(icon: RenownIconKey): ReactElement {
  switch (icon) {
    case "sigil":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 3l6 3v5c0 4.2-2.5 7.7-6 9-3.5-1.3-6-4.8-6-9V6l6-3z" />
          <path d="M12 7v9m-3-5h6" />
        </svg>
      );
    case "quill":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M18 5c-1.3 5-4.3 8.9-9 11.7L5 19l2.4-4c2.8-4.7 6.7-7.7 11.6-10z" />
          <path d="M8 16l-2 2m4-5l4 4" />
        </svg>
      );
    case "sprout":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 20v-8" />
          <path d="M12 12c0-4 2.8-6.5 7-7-0.4 4.6-3.2 7-7 7z" />
          <path d="M12 15c0-3.4-2.5-5.6-6.4-5.9 0.2 4 2.6 6.3 6.4 5.9z" />
        </svg>
      );
    case "banner":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M7 20V4" />
          <path d="M8 5h9l-2.2 3L17 11H8z" />
        </svg>
      );
    case "map":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2V6z" />
          <path d="M9 4v14m6-12v14" />
        </svg>
      );
    case "lantern":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M9 7V5a3 3 0 016 0v2" />
          <path d="M8 7h8l1 3-1.3 8H8.3L7 10l1-3z" />
          <path d="M10 11h4" />
        </svg>
      );
    case "vial":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M10 4h4" />
          <path d="M11 4v5l-4.5 7.2A3 3 0 009.1 20h5.8a3 3 0 002.6-3.8L13 9V4" />
          <path d="M9 15h6" />
        </svg>
      );
    case "satchel":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M8 9V7a4 4 0 018 0v2" />
          <path d="M5 10h14l-1 9H6l-1-9z" />
          <path d="M9 12h6" />
        </svg>
      );
    case "route":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M6 18c1.5-6.2 4.6-9.9 12-12" />
          <path d="M6 18h5" />
          <path d="M16 6h2v2" />
          <circle cx="6" cy="18" r="1.5" />
          <circle cx="18" cy="6" r="1.5" />
        </svg>
      );
    case "hammer":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M15 5l4 4-2 2-4-4z" />
          <path d="M13 7L6 14l4 4 7-7" />
          <path d="M5 19l2-2" />
        </svg>
      );
    case "archive":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M6 5h12v4H6z" />
          <path d="M7 9h10v10H7z" />
          <path d="M10 13h4" />
        </svg>
      );
    case "tower":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M9 20V8l3-2 3 2v12" />
          <path d="M8 8h8l-1-3H9z" />
          <path d="M11 14h2v6h-2z" />
        </svg>
      );
  }
}

export type RenownPanelProps = {
  renownViewportRef: RefObject<HTMLDivElement | null>;
  selectedRenownNodeId: string;
  renownView: RenownViewState;
  isRenownDragging: boolean;
  onViewportMouseDown: MouseEventHandler<HTMLDivElement>;
  onViewportWheel: WheelEventHandler<HTMLDivElement>;
  onSelectNode: (nodeId: string) => void;
  renderCharacterHubTabs: () => ReactElement;
  renownState: RenownState | null;
  isUnlocking: boolean;
  onUnlockNode: (nodeId: string) => void;
};

export function RenownPanel(props: RenownPanelProps): ReactElement {
  const { t } = useTranslation("common");
  const selectedNode = RENOWN_NODE_BY_ID.get(props.selectedRenownNodeId) ?? RENOWN_NODES[0];

  const unlockedSet: ReadonlySet<string> = props.renownState
    ? new Set(props.renownState.unlockedNodeIds)
    : new Set(RENOWN_NODES.filter((n) => n.status === "unlocked").map((n) => n.id));

  const nodeStatusMap = new Map<string, RenownNodeStatus>(
    RENOWN_NODES.map((n) => [n.id, computeRenownNodeStatus(n, unlockedSet)])
  );

  const selectedStatus = nodeStatusMap.get(selectedNode.id) ?? "locked";
  const renownBalance = props.renownState?.renownBalance ?? 0;

  return (
    <section className="contentShell">
      <section className="contentStack">
        {props.renderCharacterHubTabs()}
        <article className="contentCard renownTreeCard">
          <div className="renownTreeLayout">
            <div
              ref={props.renownViewportRef}
              className={`renownTreeViewport${props.isRenownDragging ? " isDragging" : ""}`}
              onMouseDown={props.onViewportMouseDown}
              onWheel={props.onViewportWheel}
            >
              <div
                className="renownTreeScene"
                style={{
                  width: `${RENOWN_SCENE_WIDTH}px`,
                  height: `${RENOWN_SCENE_HEIGHT}px`,
                  transform: `translate(${props.renownView.x}px, ${props.renownView.y}px) scale(${props.renownView.scale})`
                }}
              >
                <svg
                  className="renownTreeConnections"
                  viewBox={`0 0 ${RENOWN_SCENE_WIDTH} ${RENOWN_SCENE_HEIGHT}`}
                  aria-hidden="true"
                  focusable="false"
                >
                  {RENOWN_EDGES.map((edge) => {
                    const source = RENOWN_NODE_BY_ID.get(edge.from);
                    const target = RENOWN_NODE_BY_ID.get(edge.to);
                    if (!source || !target) {
                      return null;
                    }
                    const srcStatus = nodeStatusMap.get(source.id) ?? "locked";
                    const tgtStatus = nodeStatusMap.get(target.id) ?? "locked";
                    const isUnlocked =
                      srcStatus === "unlocked" && (tgtStatus === "unlocked" || tgtStatus === "available");
                    return (
                      <path
                        key={`${edge.from}-${edge.to}`}
                        className={`renownTreeEdge${isUnlocked ? " isUnlocked" : ""}`}
                        d={buildRenownEdgePath(source, target)}
                      />
                    );
                  })}
                </svg>
                {RENOWN_CANOPIES.map((canopy) => (
                  <div
                    key={canopy.id}
                    className={`renownCanopy tone-${canopy.tone}`}
                    style={{
                      left: `${canopy.x}px`,
                      top: `${canopy.y}px`,
                      width: `${canopy.width}px`,
                      height: `${canopy.height}px`,
                      transform: `rotate(${canopy.rotate}deg)`
                    }}
                  />
                ))}
                {RENOWN_NODES.map((node) => {
                  const computedStatus = nodeStatusMap.get(node.id) ?? "locked";
                  return (
                  <button
                    key={node.id}
                    type="button"
                    className={`renownNode renownNode-${computedStatus} tone-${node.tone}${
                      selectedNode.id === node.id ? " isSelected" : ""
                    }${node.tier === 0 ? " isRoot" : ""}`}
                    style={{ left: `${node.x}px`, top: `${node.y}px` }}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={() => props.onSelectNode(node.id)}
                    aria-label={node.label}
                    title={node.label}
                  >
                    <span className="renownNodeFrame" aria-hidden="true">
                      {renderRenownNodeGlyph(node.icon)}
                    </span>
                  </button>
                  );
                })}
              </div>
            </div>
            <aside className="renownDetailPanel">
              <div className="renownDetailHeader">
                <div className="renownDetailTitleBlock">
                  <p className="renownDetailEyebrow">{selectedNode.branch}</p>
                  <h3>{selectedNode.label}</h3>
                </div>
                <span className={`renownStatusBadge status-${selectedStatus}`}>{selectedStatus}</span>
              </div>
              <div className="renownDetailStats">
                <div>
                  <span>Cost</span>
                  <strong>{selectedNode.cost === 0 ? "Root" : `${selectedNode.cost} Renown`}</strong>
                </div>
                <div>
                  <span>Branch</span>
                  <strong>{selectedNode.branch}</strong>
                </div>
                <div>
                  <span>{t("renown.balance")}</span>
                  <strong>{renownBalance}</strong>
                </div>
              </div>
              {selectedStatus === "available" && (
                <button
                  type="button"
                  className="renownUnlockButton"
                  disabled={props.isUnlocking || renownBalance < selectedNode.cost}
                  onClick={() => props.onUnlockNode(selectedNode.id)}
                >
                  {props.isUnlocking
                    ? "…"
                    : renownBalance < selectedNode.cost
                      ? t("renown.insufficientRenown")
                      : `${t("renown.unlock")} (${selectedNode.cost})`}
                </button>
              )}
              <article className="renownDetailSection">
                <h4>Doctrine</h4>
                <p>{selectedNode.description}</p>
              </article>
              <article className="renownDetailSection">
                <h4>Passive</h4>
                <p>{selectedNode.effect}</p>
              </article>
              <article className="renownDetailSection">
                <h4>Requirements</h4>
                {selectedNode.requirements.length > 0 ? (
                  <ul className="renownRequirementList">
                    {selectedNode.requirements.map((requirement) => (
                      <li key={`${selectedNode.id}-${requirement}`}>{requirement}</li>
                    ))}
                  </ul>
                ) : (
                  <p>Foundational doctrine. No prior charter required.</p>
                )}
              </article>
            </aside>
          </div>
        </article>
      </section>
    </section>
  );
}
