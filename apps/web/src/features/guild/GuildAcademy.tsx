import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type {
  AcademyBranchConfig,
  AcademyDonationChargesState,
  AcademyNodeConfig,
  AcademyNodeState,
  AcademyTreeState
} from "@ebonkeep/shared/guild";

import {
  donateToAcademyNode,
  getAcademyDonationHistory,
  getAcademyMemberContributions,
  getAcademyTree
} from "./academy-api";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Constants
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CANVAS_SIZE = 1000;

export const ACADEMY_MIN_SCALE = 0.46;
export const ACADEMY_MAX_SCALE = 1.5;
export type AcademyViewState = { x: number; y: number; scale: number };
export const ACADEMY_INITIAL_VIEW: AcademyViewState = { x: 0, y: 0, scale: 0.72 };

type AcademyDetailPane = "node" | "history" | "contributions";

type AcademyGlyphKey =
  | "sigil"
  | "hammer"
  | "banner"
  | "vial"
  | "tower"
  | "satchel"
  | "map"
  | "route"
  | "archive"
  | "lantern"
  | "sprout"
  | "quill";

interface Props {
  token: string;
  guildId: string;
  playerDucats: number;
  onDucatsChanged?: (newAmount: number) => void;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Utilities
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function formatDucats(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** Maps an iconKey / branchId to a renderable glyph key. */
function getGlyphKey(iconKey: string, branchId: string): AcademyGlyphKey {
  if (iconKey.includes("core") || iconKey.includes("academy")) return "sigil";
  if (iconKey.includes("swift") || iconKey.includes("strike") || iconKey.includes("agil")) return "route";
  if (iconKey.includes("heavy") || iconKey.includes("arms") || iconKey.includes("forge")) return "hammer";
  if (iconKey.includes("shield") || iconKey.includes("defense") || iconKey.includes("wards")) return "archive";
  if (iconKey.includes("arcane") || iconKey.includes("magic") || iconKey.includes("potion")) return "vial";
  if (iconKey.includes("aoe") || iconKey.includes("blast") || iconKey.includes("area")) return "lantern";
  if (iconKey.includes("capacity") || iconKey.includes("tower") || iconKey.includes("fortress")) return "tower";
  if (iconKey.includes("logistics") || iconKey.includes("supply") || iconKey.includes("route")) return "route";
  if (iconKey.includes("treasury") || iconKey.includes("vault") || iconKey.includes("savings")) return "satchel";
  if (iconKey.includes("commerce") || iconKey.includes("trade") || iconKey.includes("merchant")) return "map";
  if (iconKey.includes("venture") || iconKey.includes("expedition")) return "sprout";
  if (iconKey.includes("combat") || iconKey.includes("warrior") || iconKey.includes("battle")) return "banner";
  switch (branchId) {
    case "combat": return "hammer";
    case "arcane": return "vial";
    case "guild": return "tower";
    case "commerce": return "satchel";
    default: return "sigil";
  }
}

/**
 * Cubic bezier S-curve — same formula as RenownPanel.buildRenownEdgePath.
 * C1 sits directly above the source (same X, Y shifted up);
 * C2 sits directly below the target (same X, Y shifted down).
 * This produces the characteristic branching S-curves of the renown tree.
 */
function buildAcademyEdgePath(ax: number, ay: number, bx: number, by: number): string {
  const controlYOffset = Math.max(54, Math.abs(ay - by) * 0.38);
  return `M ${ax} ${ay} C ${ax} ${ay - controlYOffset}, ${bx} ${by + controlYOffset}, ${bx} ${by}`;
}

/** Compute per-branch canopy halos from config node positions. */
function buildAcademyCanopies(config: AcademyTreeState["config"]): Array<{
  id: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  color: string;
}> {
  return config.branches
    .map((branch) => {
      const nodes = config.nodes.filter((n) => n.branchId === branch.id);
      if (nodes.length === 0) return null;
      const cx = nodes.reduce((s, n) => s + n.position.x, 0) / nodes.length;
      const cy = nodes.reduce((s, n) => s + n.position.y, 0) / nodes.length;
      const maxDist = Math.max(
        ...nodes.map((n) => Math.sqrt((n.position.x - cx) ** 2 + (n.position.y - cy) ** 2))
      );
      const r = Math.max(110, maxDist + 90);
      return { id: branch.id, cx, cy, rx: r * 1.15, ry: r, color: branch.color };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);
}

/** SVG path glyphs (same stroked-path style as RenownPanel). */
function renderAcademyGlyph(glyph: AcademyGlyphKey): ReactElement {
  switch (glyph) {
    case "sigil":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 3l6 3v5c0 4.2-2.5 7.7-6 9-3.5-1.3-6-4.8-6-9V6l6-3z" />
          <path d="M12 7v9m-3-5h6" />
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
    case "banner":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M7 20V4" />
          <path d="M8 5h9l-2.2 3L17 11H8z" />
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
    case "tower":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M9 20V8l3-2 3 2v12" />
          <path d="M8 8h8l-1-3H9z" />
          <path d="M11 14h2v6h-2z" />
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
    case "map":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2V6z" />
          <path d="M9 4v14m6-12v14" />
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
    case "archive":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M6 5h12v4H6z" />
          <path d="M7 9h10v10H7z" />
          <path d="M10 13h4" />
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
    case "sprout":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 20v-8" />
          <path d="M12 12c0-4 2.8-6.5 7-7-0.4 4.6-3.2 7-7 7z" />
          <path d="M12 15c0-3.4-2.5-5.6-6.4-5.9 0.2 4 2.6 6.3 6.4 5.9z" />
        </svg>
      );
    case "quill":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M18 5c-1.3 5-4.3 8.9-9 11.7L5 19l2.4-4c2.8-4.7 6.7-7.7 11.6-10z" />
          <path d="M8 16l-2 2m4-5l4 4" />
        </svg>
      );
  }
}


// -----------------------------------------------------------------------------
// AcademyNodeButton
// -----------------------------------------------------------------------------

function AcademyNodeButton({
  node,
  state,
  branch,
  selected,
  isCenter,
  onClick
}: {
  node: AcademyNodeConfig;
  state: AcademyNodeState;
  branch?: AcademyBranchConfig;
  selected: boolean;
  isCenter: boolean;
  onClick: () => void;
}): ReactElement {
  const glyph = getGlyphKey(node.iconKey, node.branchId);
  const isMaxed = state.status === "maxed";
  const pct = node.maxLevel > 0 ? (state.currentLevel / node.maxLevel) * 100 : 0;
  const branchColor = branch?.color ?? "rgba(178,143,86,0.4)";

  return (
    <button
      type="button"
      className={[
        "academyNode",
        `academyNode-${state.status}`,
        `tone-${node.branchId}`,
        selected ? "isSelected" : "",
        isCenter ? "isRoot" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ left: `${node.position.x}px`, top: `${node.position.y}px` }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onClick}
      aria-label={node.label}
      title={node.label}
    >
      {state.status === "in_progress" && (
        <svg className="academyNodeRing" viewBox="0 0 96 96" aria-hidden="true">
          <circle cx="48" cy="48" r="43" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
          <circle
            cx="48"
            cy="48"
            r="43"
            fill="none"
            stroke={branchColor}
            strokeWidth="5"
            strokeDasharray={`${pct * 2.7} 270`}
            strokeLinecap="round"
            transform="rotate(-90 48 48)"
          />
        </svg>
      )}
      <span className="academyNodeFrame" aria-hidden="true">
        {renderAcademyGlyph(glyph)}
      </span>
      {!isCenter && (
        <span className="academyNodeLevelBadge" aria-hidden="true">
          {state.currentLevel}/{node.maxLevel}
        </span>
      )}
      {isMaxed && (
        <span className="academyNodeMaxedStar" aria-hidden="true">
          ?
        </span>
      )}
    </button>
  );
}

// -----------------------------------------------------------------------------
// LevelProgressBar
// -----------------------------------------------------------------------------

function LevelProgressBar({ node, state }: { node: AcademyNodeConfig; state: AcademyNodeState }): ReactElement | null {
  const { t } = useTranslation("common");
  const currentLevelConfig = node.levels[state.currentLevel];
  if (!currentLevelConfig) return null;

  const costForNextLevel = currentLevelConfig.ducatCost;
  const prevCumulative = node.levels
    .slice(0, state.currentLevel)
    .reduce((s, l) => s + l.ducatCost, 0);
  const investedTowardsNext = Math.max(0, state.ducatsInvested - prevCumulative);
  const pct = Math.min(100, (investedTowardsNext / costForNextLevel) * 100);

  return (
    <div className="academyProgressSection">
      <div className="academyProgressLabel">
        <span>{t("academy.nextLevel")}</span>
        <span>
          {formatDucats(investedTowardsNext)} / {formatDucats(costForNextLevel)}
        </span>
      </div>
      <div className="academyProgressTrack">
        <div className="academyProgressFill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// AcademyDonateModal
// -----------------------------------------------------------------------------

function AcademyDonateModal({
  node,
  state,
  playerDucats,
  donating,
  donateError,
  donateSuccess,
  donateAmount,
  onAmountChange,
  onSubmit,
  onClose
}: {
  node: AcademyNodeConfig;
  state: AcademyNodeState;
  playerDucats: number;
  donating: boolean;
  donateError: string | null;
  donateSuccess: string | null;
  donateAmount: string;
  onAmountChange: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}): ReactElement {
  const { t } = useTranslation("common");
  const maxDonatable =
    state.ducatsToNextLevel !== null ? Math.min(playerDucats, state.ducatsToNextLevel) : 0;

  return (
    <div className="academyModalOverlay" onClick={onClose}>
      <div className="academyModal" onClick={(e) => e.stopPropagation()}>
        <div className="academyModalHeader">
          <div className="academyModalTitleBlock">
            <p className="academyModalEyebrow">{t("academy.donate.title")}</p>
            <h3>{node.label}</h3>
          </div>
          <button
            type="button"
            className="academyModalClose"
            onClick={onClose}
            aria-label="Close"
          >
            �
          </button>
        </div>

        <div className="academyModalMeta">
          <div>
            <span>{t("academy.level")}</span>
            <strong>
              {state.currentLevel}/{node.maxLevel}
            </strong>
          </div>
          <div>
            <span>{t("academy.donate.yourDucats")}</span>
            <strong>{formatDucats(playerDucats)}</strong>
          </div>
          {state.ducatsToNextLevel !== null && (
            <div>
              <span>{t("academy.toNextLevel")}</span>
              <strong>{formatDucats(state.ducatsToNextLevel)}</strong>
            </div>
          )}
        </div>

        <div className="academyModalInput">
          <input
            type="number"
            min={1}
            max={maxDonatable}
            value={donateAmount}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder={t("academy.donate.amountPlaceholder")}
            className="academyModalAmountInput"
          />
          <button
            type="button"
            className="academyModalMaxBtn"
            onClick={() => onAmountChange(String(maxDonatable))}
            disabled={maxDonatable === 0}
          >
            {t("academy.donate.max")}
          </button>
        </div>

        {donateError && <p className="academyModalError">{donateError}</p>}
        {donateSuccess && <p className="academyModalSuccess">{donateSuccess}</p>}

        <div className="academyModalActions">
          <button
            type="button"
            className="buttonSecondary"
            onClick={onClose}
            disabled={donating}
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            className="buttonPrimary"
            onClick={onSubmit}
            disabled={donating || !donateAmount || parseInt(donateAmount, 10) < 1}
          >
            {donating ? t("academy.donate.donating") : t("academy.donate.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// AcademyDonatePanel  (charge-based donation — Rise of Kingdoms style)
// -----------------------------------------------------------------------------

function AcademyDonatePanel({
  chargesState,
  donating,
  donateError,
  donateSuccess,
  onDonate
}: {
  chargesState: AcademyDonationChargesState;
  donating: boolean;
  donateError: string | null;
  donateSuccess: string | null;
  onDonate: (chargesSpent: number) => void;
}): ReactElement {
  const { t } = useTranslation("common");
  const [timeLeft, setTimeLeft] = useState<number | null>(chargesState.secondsUntilNext);

  useEffect(() => {
    setTimeLeft(chargesState.secondsUntilNext);
    if (chargesState.secondsUntilNext === null) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 0) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [chargesState.secondsUntilNext]);

  function formatTime(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  const hasCharges = chargesState.charges > 0;
  const isFull = chargesState.charges >= chargesState.maxCharges;

  return (
    <div className="academyDonatePanel">
      <div className="academyDonatePanelHeader">
        <span className="academyDonatePanelTitle">{t("academy.donate.button")}</span>
        <span className="academyChargesCount">
          {chargesState.charges}
          <span className="academyChargesMax"> / {chargesState.maxCharges}</span>
        </span>
      </div>

      {/* Charge pips */}
      <div className="academyChargesPips" aria-label={t("academy.charges.label")}>
        {Array.from({ length: chargesState.maxCharges }).map((_, i) => (
          <span
            key={i}
            className={`academyChargesPip${i < chargesState.charges ? " isFilled" : ""}`}
          />
        ))}
      </div>

      {/* Regen info row */}
      <div className="academyChargesRegenRow">
        {isFull ? (
          <span className="academyChargesFullText">{t("academy.charges.full")}</span>
        ) : timeLeft !== null ? (
          <span className="academyChargesTimer">
            {t("academy.charges.nextIn", { time: formatTime(timeLeft) })}
          </span>
        ) : null}
        <span className="academyChargesRateInfo">
          {t("academy.charges.perCharge", { amount: formatDucats(chargesState.ducatsPerCharge) })}
        </span>
      </div>

      {donateError && <p className="academyDonateError">{donateError}</p>}
      {donateSuccess && <p className="academyDonateSuccess">{donateSuccess}</p>}

      <div className="academyDonateActions">
        <button
          type="button"
          className="academyDonateActionBtn academyDonateActionBtn--one"
          onClick={() => onDonate(1)}
          disabled={!hasCharges || donating}
        >
          {donating ? t("academy.donate.donating") : t("academy.donate.donate1")}
        </button>
        <button
          type="button"
          className="academyDonateActionBtn academyDonateActionBtn--all"
          onClick={() => onDonate(chargesState.charges)}
          disabled={!hasCharges || donating}
        >
          {t("academy.donate.donateAll", { count: chargesState.charges })}
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main component
// -----------------------------------------------------------------------------

export function GuildAcademy({ token, guildId, playerDucats, onDucatsChanged }: Props): ReactElement {
  const { t } = useTranslation("common");

  const [treeState, setTreeState] = useState<AcademyTreeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [detailPane, setDetailPane] = useState<AcademyDetailPane>("node");
  const [donating, setDonating] = useState(false);
  const [donateError, setDonateError] = useState<string | null>(null);
  const [donateSuccess, setDonateSuccess] = useState<string | null>(null);

  const [donations, setDonations] = useState<any[]>([]);
  const [contributions, setContributions] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Pan / zoom � mirroring RenownPanel pattern
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    pointerX: number;
    pointerY: number;
    viewX: number;
    viewY: number;
  } | null>(null);
  const [academyView, setAcademyView] = useState<AcademyViewState>(ACADEMY_INITIAL_VIEW);
  const [isDragging, setIsDragging] = useState(false);
  const currentDucats = useRef(playerDucats);
  currentDucats.current = playerDucats;

  // -- Viewport clamping -----------------------------------------------------

  function clampAcademyView(nextX: number, nextY: number, nextScale: number): AcademyViewState {
    const scale = Math.max(ACADEMY_MIN_SCALE, Math.min(ACADEMY_MAX_SCALE, nextScale));
    const viewport = viewportRef.current;
    if (!viewport) return { x: nextX, y: nextY, scale };

    const vr = viewport.getBoundingClientRect();
    const W = CANVAS_SIZE * scale;
    const H = CANVAS_SIZE * scale;
    const marginX = Math.max(64, vr.width * 0.08);
    const marginY = Math.max(52, vr.height * 0.08);

    const x =
      W + marginX * 2 <= vr.width
        ? (vr.width - W) / 2
        : Math.max(vr.width - W - marginX, Math.min(marginX, nextX));
    const y =
      H + marginY * 2 <= vr.height
        ? (vr.height - H) / 2
        : Math.max(vr.height - H - marginY, Math.min(marginY, nextY));

    return { x, y, scale };
  }

  // -- Pan / Zoom handlers ---------------------------------------------------

  function handleViewportMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    dragStateRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      viewX: academyView.x,
      viewY: academyView.y
    };
    setIsDragging(true);
  }

  function handleViewportWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) return;
    const vr = viewport.getBoundingClientRect();
    const factor = e.deltaY < 0 ? 1.12 : 0.9;
    setAcademyView((cur) => {
      const nextScale = Math.max(ACADEMY_MIN_SCALE, Math.min(ACADEMY_MAX_SCALE, cur.scale * factor));
      const ox = e.clientX - vr.left;
      const oy = e.clientY - vr.top;
      const sx = (ox - cur.x) / cur.scale;
      const sy = (oy - cur.y) / cur.scale;
      return clampAcademyView(ox - sx * nextScale, oy - sy * nextScale, nextScale);
    });
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      setAcademyView((cur) =>
        clampAcademyView(
          drag.viewX + (e.clientX - drag.pointerX),
          drag.viewY + (e.clientY - drag.pointerY),
          cur.scale
        )
      );
    };
    const stopDrag = () => {
      if (!dragStateRef.current) return;
      dragStateRef.current = null;
      setIsDragging(false);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopDrag);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopDrag);
    };
  }, []);

  // -- Data fetching ---------------------------------------------------------

  const loadTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const state = await getAcademyTree(token, guildId);
      setTreeState(state);
      if (!state.config.centerNodeId) return;
      // Auto-select the center node on first load
      setSelectedNodeId((prev) => prev ?? state.config.centerNodeId);
    } catch (e: any) {
      setError(e.message ?? t("academy.errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [token, guildId, t]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const loadHistory = useCallback(async () => {
    if (historyLoading) return;
    setHistoryLoading(true);
    try {
      const [hist, contrib] = await Promise.all([
        getAcademyDonationHistory(token, guildId),
        getAcademyMemberContributions(token, guildId)
      ]);
      setDonations(hist.donations);
      setContributions(contrib.contributions);
    } finally {
      setHistoryLoading(false);
    }
  }, [token, guildId, historyLoading]);

  useEffect(() => {
    if (detailPane === "history" || detailPane === "contributions") {
      loadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailPane]);

  // -- Node interaction ------------------------------------------------------

  function handleNodeClick(nodeId: string) {
    if (!treeState) return;
    const state = treeState.nodes[nodeId];
    if (!state || state.status === "locked") return;
    setSelectedNodeId(nodeId);
    setDetailPane("node");
    // Clear donate feedback when switching node
    setDonateError(null);
    setDonateSuccess(null);
  }

  // -- Donation submit -------------------------------------------------------

  async function handleDonate(chargesSpent: number) {
    if (!treeState || !selectedNodeId) return;
    if (chargesSpent < 1) return;
    const cs = treeState.chargesState;
    if (chargesSpent > cs.charges) {
      setDonateError(t("academy.errors.insufficientCharges"));
      return;
    }
    setDonating(true);
    setDonateError(null);
    setDonateSuccess(null);
    try {
      const result = await donateToAcademyNode(token, guildId, { nodeId: selectedNodeId, chargesSpent });
      onDucatsChanged?.(result.remainingDucats);
      // Update tree state locally with fresh charges state and node state
      const newTree = await getAcademyTree(token, guildId);
      setTreeState(newTree);
      const levelsMsg =
        result.levelsGained > 0
          ? t("academy.donate.levelsGained", { count: result.levelsGained })
          : "";
      const ducatsAmount = chargesSpent * cs.ducatsPerCharge;
      setDonateSuccess(
        t("academy.donate.success", { amount: formatDucats(ducatsAmount) }) + (levelsMsg ? ` ${levelsMsg}` : "")
      );
    } catch (e: any) {
      setDonateError(e.message ?? t("academy.errors.donateFailed"));
    } finally {
      setDonating(false);
    }
  }

  // -- Derived ---------------------------------------------------------------

  const selectedNode =
    treeState && selectedNodeId
      ? treeState.config.nodes.find((n) => n.id === selectedNodeId)
      : null;
  const selectedState =
    treeState && selectedNodeId ? treeState.nodes[selectedNodeId] : null;

  // -- Loading / error states ------------------------------------------------

  if (loading) {
    return (
      <div className="academyTreeLayout">
        <div className="academyTreeViewport academyTreeViewport--loading">
          <p className="academyLoadingText">{t("academy.loading")}</p>
        </div>
        <aside className="academyDetailPanel" />
      </div>
    );
  }

  if (error || !treeState) {
    return (
      <div className="academyTreeLayout">
        <div className="academyTreeViewport academyTreeViewport--loading">
          <p className="academyLoadingText">{error ?? t("academy.errors.loadFailed")}</p>
          <button className="buttonSecondary" onClick={loadTree}>
            {t("retry")}
          </button>
        </div>
        <aside className="academyDetailPanel" />
      </div>
    );
  }

  const canopies = buildAcademyCanopies(treeState.config);

  // -- Render ----------------------------------------------------------------

  return (
    <>
      <div className="academyTreeLayout">
        {/* -- Viewport -- */}
        <div
          ref={viewportRef}
          className={`academyTreeViewport${isDragging ? " isDragging" : ""}`}
          onMouseDown={handleViewportMouseDown}
          onWheel={handleViewportWheel}
        >
          <div
            className="academyTreeScene"
            style={{
              width: `${CANVAS_SIZE}px`,
              height: `${CANVAS_SIZE}px`,
              transform: `translate(${academyView.x}px, ${academyView.y}px) scale(${academyView.scale})`
            }}
          >
            {/* SVG connectors */}
            <svg
              className="academyTreeConnections"
              viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
              aria-hidden="true"
              focusable="false"
            >
              {treeState.config.nodes.map((node) =>
                node.prerequisites.map((prereq) => {
                  const fromNode = treeState.config.nodes.find((n) => n.id === prereq.nodeId);
                  if (!fromNode) return null;
                  const fromNodeState = treeState.nodes[fromNode.id];
                  const toNodeState = treeState.nodes[node.id];
                  const isUnlocked =
                    fromNodeState &&
                    fromNodeState.currentLevel >= prereq.minLevel &&
                    toNodeState &&
                    toNodeState.status !== "locked";
                  const d = buildAcademyEdgePath(
                    fromNode.position.x,
                    fromNode.position.y,
                    node.position.x,
                    node.position.y
                  );
                  return (
                    <path
                      key={`${prereq.nodeId}->${node.id}`}
                      className={`academyTreeEdge${isUnlocked ? " isUnlocked" : ""}`}
                      d={d}
                    />
                  );
                })
              )}
            </svg>

            {/* Branch canopy halos */}
            {canopies.map((c) => (
              <div
                key={c.id}
                className={`academyCanopy tone-${c.id}`}
                style={{
                  left: `${c.cx}px`,
                  top: `${c.cy}px`,
                  width: `${c.rx * 2}px`,
                  height: `${c.ry * 2}px`,
                  transform: "translate(-50%, -50%)"
                }}
              />
            ))}

            {/* Nodes */}
            {treeState.config.nodes.map((node) => {
              const state = treeState.nodes[node.id];
              if (!state) return null;
              if (node.hiddenUntilUnlocked && state.status === "locked") return null;
              const branch = treeState.config.branches.find((b) => b.id === node.branchId);
              return (
                <AcademyNodeButton
                  key={node.id}
                  node={node}
                  state={state}
                  branch={branch}
                  selected={selectedNodeId === node.id}
                  isCenter={node.id === treeState.config.centerNodeId}
                  onClick={() => handleNodeClick(node.id)}
                />
              );
            })}
          </div>

          {/* Zoom controls (bottom-right corner of viewport) */}
          <div className="academyZoomControls">
            <button
              type="button"
              className="academyZoomBtn"
              onClick={() =>
                setAcademyView((cur) =>
                  clampAcademyView(cur.x, cur.y, cur.scale * 1.12)
                )
              }
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              className="academyZoomBtn"
              onClick={() =>
                setAcademyView((cur) =>
                  clampAcademyView(cur.x, cur.y, cur.scale * 0.9)
                )
              }
              aria-label="Zoom out"
            >
              -
            </button>
            <button
              type="button"
              className="academyZoomBtn"
              onClick={() => setAcademyView(ACADEMY_INITIAL_VIEW)}
              aria-label={t("academy.resetView")}
            >
              ?
            </button>
          </div>
        </div>

        {/* -- Detail panel -- */}
        <aside className="academyDetailPanel">
          {/* Panel tabs */}
          <div className="academyDetailTabs">
            {(["node", "history", "contributions"] as AcademyDetailPane[]).map((pane) => (
              <button
                key={pane}
                type="button"
                className={`academyDetailTab${detailPane === pane ? " active" : ""}`}
                onClick={() => setDetailPane(pane)}
              >
                {t(`academy.views.${pane === "node" ? "tree" : pane}`)}
              </button>
            ))}
          </div>

          {/* Total donated banner */}
          <div className="academyTotalBanner">
            <span className="academyTotalLabel">{t("academy.totalDonated")}</span>
            <strong className="academyTotalValue">{formatDucats(treeState.totalDonated)}</strong>
          </div>

          {/* -- Node detail pane -- */}
          {detailPane === "node" && (
            <>
              {selectedNode && selectedState ? (
                <>
                  <div className="academyDetailHeader">
                    <div className="academyDetailTitleBlock">
                      <p className="academyDetailEyebrow">
                        {treeState.config.branches.find((b) => b.id === selectedNode.branchId)
                          ?.label ?? selectedNode.branchId}
                      </p>
                      <h3>{selectedNode.label}</h3>
                    </div>
                    <span className={`academyStatusBadge status-${selectedState.status}`}>
                      {t(`academy.status.${selectedState.status}`)}
                    </span>
                  </div>

                  <div className="academyDetailStats">
                    <div>
                      <span>{t("academy.level")}</span>
                      <strong>
                        {selectedState.currentLevel}/{selectedNode.maxLevel}
                      </strong>
                    </div>
                    <div>
                      <span>{t("academy.totalDonated")}</span>
                      <strong>{formatDucats(selectedState.ducatsInvested)}</strong>
                    </div>
                    {selectedState.ducatsToNextLevel !== null && (
                      <div>
                        <span>{t("academy.toNextLevel")}</span>
                        <strong>{formatDucats(selectedState.ducatsToNextLevel)}</strong>
                      </div>
                    )}
                  </div>

                  {selectedState.status !== "maxed" && selectedState.status !== "locked" && (
                    <LevelProgressBar node={selectedNode} state={selectedState} />
                  )}

                  <article className="academyDetailSection">
                    <h4>{t("academy.description")}</h4>
                    <p>{selectedNode.description}</p>
                  </article>

                  {/* Level rewards */}
                  <article className="academyDetailSection">
                    <h4>{t("academy.rewards.title")}</h4>
                    <div className="academyRewardList">
                      {selectedNode.levels.map((lvl) => (
                        <div
                          key={lvl.level}
                          className={`academyRewardRow${
                            selectedState.currentLevel >= lvl.level ? " isEarned" : ""
                          }`}
                        >
                          <span className="academyRewardLvlBadge">
                            {t("academy.level")} {lvl.level}
                          </span>
                          {lvl.rewards.map((r, i) => (
                            <span key={i} className="academyRewardChip">
                              {r.description}
                            </span>
                          ))}
                        </div>
                      ))}
                      {selectedNode.completionReward && (
                        <div
                          className={`academyRewardRow academyRewardRow--completion${
                            selectedState.status === "maxed" ? " isEarned" : ""
                          }`}
                        >
                          <span className="academyRewardLvlBadge">
                            {t("academy.rewards.completion")}
                          </span>
                          <span className="academyRewardChip">
                            {selectedNode.completionReward.description}
                          </span>
                        </div>
                      )}
                    </div>
                  </article>

                  {/* Prerequisites */}
                  {selectedNode.prerequisites.length > 0 && (
                    <article className="academyDetailSection">
                      <h4>{t("academy.prerequisites")}</h4>
                      <ul className="academyPrereqList">
                        {selectedNode.prerequisites.map((prereq) => {
                          const prereqConfig = treeState.config.nodes.find(
                            (n) => n.id === prereq.nodeId
                          );
                          const prereqState = treeState.nodes[prereq.nodeId];
                          const met = prereqState && prereqState.currentLevel >= prereq.minLevel;
                          return (
                            <li
                              key={prereq.nodeId}
                              className={`academyPrereqItem${met ? " isMet" : ""}`}
                            >
                              {prereqConfig?.label ?? prereq.nodeId} (
                              {t("academy.level")} {prereq.minLevel})
                            </li>
                          );
                        })}
                      </ul>
                    </article>
                  )}

                  {/* Action */}
                  {selectedState.status !== "maxed" && selectedState.status !== "locked" && (
                    <AcademyDonatePanel
                      chargesState={treeState.chargesState}
                      donating={donating}
                      donateError={donateError}
                      donateSuccess={donateSuccess}
                      onDonate={handleDonate}
                    />
                  )}
                  {selectedState.status === "maxed" && (
                    <div className="academyMaxedBadge">{t("academy.status.maxed")} ?</div>
                  )}
                </>
              ) : (
                <div className="academyDetailPlaceholder">
                  <p>{t("academy.selectNode")}</p>
                </div>
              )}
            </>
          )}

          {/* -- History pane -- */}
          {detailPane === "history" && (
            <>
              {historyLoading ? (
                <div className="academyDetailPlaceholder">
                  <p>{t("loading")}</p>
                </div>
              ) : donations.length === 0 ? (
                <div className="academyDetailPlaceholder">
                  <p>{t("academy.history.empty")}</p>
                </div>
              ) : (
                <div className="academyHistoryList">
                  {donations.map((d) => (
                    <div key={d.id} className="academyHistoryRow">
                      <span className="academyHistoryPlayer">{d.playerName}</span>
                      <span className="academyHistoryNode">
                        {d.nodeId.replace(/_/g, " ")}
                      </span>
                      <span className="academyHistoryAmount">
                        +{formatDucats(d.amount)}
                      </span>
                      <span className="academyHistoryDate">
                        {new Date(d.donatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* -- Contributions pane -- */}
          {detailPane === "contributions" && (
            <>
              {historyLoading ? (
                <div className="academyDetailPlaceholder">
                  <p>{t("loading")}</p>
                </div>
              ) : contributions.length === 0 ? (
                <div className="academyDetailPlaceholder">
                  <p>{t("academy.contributions.empty")}</p>
                </div>
              ) : (
                <div className="academyContribList">
                  {contributions.map((c, i) => (
                    <div key={c.playerId} className="academyContribRow">
                      <span className="academyContribRank">#{i + 1}</span>
                      <span className="academyContribName">{c.playerName}</span>
                      <span className="academyContribTotal">
                        {formatDucats(c.totalDonated)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </aside>
      </div>

    </>
  );
}
