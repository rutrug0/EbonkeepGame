import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type {
  AcademyBranchConfig,
  AcademyNodeConfig,
  AcademyNodeState,
  AcademyNodeStatus,
  AcademyTreeState
} from "@ebonkeep/shared/guild";

import {
  donateToAcademyNode,
  getAcademyDonationHistory,
  getAcademyMemberContributions,
  getAcademyTree
} from "./academy-api";

// ─────────────────────────────────────────────────────────────────────────────
// Types / constants
// ─────────────────────────────────────────────────────────────────────────────

const CANVAS_SIZE = 1000;
const NODE_RADIUS = 44;

type AcademyView = "tree" | "history" | "contributions";

interface Props {
  token: string;
  guildId: string;
  playerDucats: number;
  onDucatsChanged?: (newAmount: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function statusColor(status: AcademyNodeStatus): string {
  switch (status) {
    case "locked":      return "#3a3a4a";
    case "available":   return "#1e3a5f";
    case "in_progress": return "#7c3b00";
    case "completed":   return "#1a5c2a";
    case "maxed":       return "#6b4c00";
    default:            return "#222";
  }
}

function statusBorderColor(status: AcademyNodeStatus): string {
  switch (status) {
    case "locked":      return "#555566";
    case "available":   return "#4a9eff";
    case "in_progress": return "#ff8c00";
    case "completed":   return "#4caf50";
    case "maxed":       return "#D4AF37";
    default:            return "#555";
  }
}

function getBranchColor(config: AcademyTreeState, nodeId: string): string {
  const node = config.config.nodes.find((n) => n.id === nodeId);
  if (!node) return "#888";
  const branch = config.config.branches.find((b) => b.id === node.branchId);
  return branch?.color ?? "#888";
}

function formatDucats(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function GuildAcademy({ token, guildId, playerDucats, onDucatsChanged }: Props) {
  const { t } = useTranslation("common");

  const [view, setView] = useState<AcademyView>("tree");
  const [treeState, setTreeState] = useState<AcademyTreeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [donateModalOpen, setDonateModalOpen] = useState(false);
  const [donateAmount, setDonateAmount] = useState("");
  const [donating, setDonating] = useState(false);
  const [donateError, setDonateError] = useState<string | null>(null);
  const [donateSuccess, setDonateSuccess] = useState<string | null>(null);

  const [donations, setDonations] = useState<any[]>([]);
  const [contributions, setContributions] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // pan / zoom
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(0.72);
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  const currentDucats = useRef(playerDucats);
  currentDucats.current = playerDucats;

  // ── Data fetching ───────────────────────────────────────────────────────────

  const loadTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const state = await getAcademyTree(token, guildId);
      setTreeState(state);
    } catch (e: any) {
      setError(e.message ?? t("academy.errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [token, guildId, t]);

  useEffect(() => { loadTree(); }, [loadTree]);

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
    if (view === "history" || view === "contributions") {
      loadHistory();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // ── Pan / Zoom handlers ─────────────────────────────────────────────────────

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".academyNode")) return;
    isPanning.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  };

  const handleMouseUp = () => { isPanning.current = false; };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.min(2, Math.max(0.3, s - e.deltaY * 0.001)));
  };

  // ── Node click ──────────────────────────────────────────────────────────────

  const handleNodeClick = (nodeId: string) => {
    if (!treeState) return;
    const state = treeState.nodes[nodeId];
    if (!state || state.status === "locked") return;
    setSelectedNodeId(nodeId);
    if (state.status !== "maxed") {
      setDonateAmount("");
      setDonateError(null);
      setDonateSuccess(null);
      setDonateModalOpen(true);
    }
  };

  // ── Donation submit ─────────────────────────────────────────────────────────

  const handleDonate = async () => {
    if (!treeState || !selectedNodeId) return;
    const amt = parseInt(donateAmount, 10);
    if (isNaN(amt) || amt < 1) {
      setDonateError(t("academy.errors.invalidAmount"));
      return;
    }
    if (amt > currentDucats.current) {
      setDonateError(t("academy.errors.insufficientDucats"));
      return;
    }
    setDonating(true);
    setDonateError(null);
    try {
      const result = await donateToAcademyNode(token, guildId, { nodeId: selectedNodeId, amount: amt });
      onDucatsChanged?.(result.remainingDucats);
      // Refresh tree state
      const newState = await getAcademyTree(token, guildId);
      setTreeState(newState);
      const levelsMsg = result.levelsGained > 0
        ? t("academy.donate.levelsGained", { count: result.levelsGained })
        : "";
      setDonateSuccess(t("academy.donate.success", { amount: formatDucats(amt) }) + (levelsMsg ? ` ${levelsMsg}` : ""));
      setDonateAmount("");
    } catch (e: any) {
      setDonateError(e.message ?? t("academy.errors.donateFailed"));
    } finally {
      setDonating(false);
    }
  };

  // ── Derived helpers ─────────────────────────────────────────────────────────

  const selectedNode = treeState && selectedNodeId ? treeState.config.nodes.find((n) => n.id === selectedNodeId) : null;
  const selectedState = treeState && selectedNodeId ? treeState.nodes[selectedNodeId] : null;

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="academyContainer">
        <div className="academyLoading">{t("academy.loading")}</div>
      </div>
    );
  }

  if (error || !treeState) {
    return (
      <div className="academyContainer">
        <div className="academyError">{error ?? t("academy.errors.loadFailed")}</div>
        <button className="buttonSecondary" onClick={loadTree}>{t("retry")}</button>
      </div>
    );
  }

  return (
    <div className="academyContainer">
      {/* ── Top bar ── */}
      <div className="academyTopBar">
        <div className="academyTopBarLeft">
          <h3 className="academyTitle">{t("academy.title")}</h3>
          <span className="academyTotalDonated">
            {t("academy.totalDonated")}: <strong>{formatDucats(treeState.totalDonated)}</strong>
          </span>
        </div>
        <div className="academyTopBarRight">
          <nav className="academyViewNav">
            {(["tree", "history", "contributions"] as AcademyView[]).map((v) => (
              <button
                key={v}
                type="button"
                className={`academyViewTab${view === v ? " active" : ""}`}
                onClick={() => setView(v)}
              >
                {t(`academy.views.${v}`)}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ── Tree view ── */}
      {view === "tree" && (
        <div className="academyTreeWrapper">
          {/* Canvas */}
          <div
            className="academyCanvas"
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            <div
              className="academyTransform"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                width: CANVAS_SIZE,
                height: CANVAS_SIZE
              }}
            >
              {/* SVG connector lines */}
              <svg
                className="academyConnectors"
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
              >
                {treeState.config.nodes.map((node) =>
                  node.prerequisites.map((prereq) => {
                    const fromNode = treeState.config.nodes.find((n) => n.id === prereq.nodeId);
                    if (!fromNode) return null;
                    const fromState = treeState.nodes[fromNode.id];
                    const toState = treeState.nodes[node.id];
                    const unlocked = fromState && fromState.currentLevel >= prereq.minLevel;
                    const branchColor = getBranchColor(treeState, node.id);
                    return (
                      <line
                        key={`${prereq.nodeId}->${node.id}`}
                        x1={fromNode.position.x}
                        y1={fromNode.position.y}
                        x2={node.position.x}
                        y2={node.position.y}
                        stroke={unlocked ? branchColor : "#3a3a4a"}
                        strokeWidth={unlocked ? 3 : 2}
                        strokeOpacity={unlocked ? 0.8 : 0.35}
                        strokeDasharray={toState?.status === "locked" ? "8 6" : undefined}
                      />
                    );
                  })
                )}
              </svg>

              {/* Node cards */}
              {treeState.config.nodes.map((node) => {
                const state = treeState.nodes[node.id];
                if (!state) return null;
                if (node.hiddenUntilUnlocked && state.status === "locked") return null;
                const branch = treeState.config.branches.find((b) => b.id === node.branchId);
                return (
                  <AcademyNodeCard
                    key={node.id}
                    node={node}
                    state={state}
                    branch={branch}
                    selected={selectedNodeId === node.id}
                    onClick={() => handleNodeClick(node.id)}
                  />
                );
              })}
            </div>
          </div>

          {/* Zoom controls */}
          <div className="academyZoomControls">
            <button type="button" className="academyZoomBtn" onClick={() => setScale((s) => Math.min(2, s + 0.1))}>+</button>
            <button type="button" className="academyZoomBtn" onClick={() => setScale((s) => Math.max(0.3, s - 0.1))}>−</button>
            <button type="button" className="academyZoomBtn" onClick={() => { setScale(0.72); setPan({ x: 0, y: 0 }); }}>
              {t("academy.resetView")}
            </button>
          </div>

          {/* Legend */}
          <div className="academyLegend">
            {(["locked", "available", "in_progress", "completed", "maxed"] as AcademyNodeStatus[]).map((s) => (
              <div key={s} className="academyLegendItem">
                <span className="academyLegendDot" style={{ background: statusBorderColor(s) }} />
                <span>{t(`academy.status.${s}`)}</span>
              </div>
            ))}
          </div>

          {/* Side panel: selected node */}
          {selectedNode && selectedState && (
            <div className="academyNodePanel">
              <h4 className="academyNodePanelTitle">{selectedNode.label}</h4>
              <p className="academyNodePanelDesc">{selectedNode.description}</p>

              <div className="academyNodePanelMeta">
                <div>{t("academy.level")}: <strong>{selectedState.currentLevel}/{selectedNode.maxLevel}</strong></div>
                <div>{t("academy.status.label")}: <strong>{t(`academy.status.${selectedState.status}`)}</strong></div>
                {selectedState.ducatsToNextLevel !== null && (
                  <div>{t("academy.toNextLevel")}: <strong>{formatDucats(selectedState.ducatsToNextLevel)} {t("currency.ducats")}</strong></div>
                )}
              </div>

              {/* Progress bar for current level */}
              {selectedState.status !== "maxed" && selectedState.status !== "locked" && (
                <LevelProgressBar node={selectedNode} state={selectedState} />
              )}

              {/* Level rewards preview */}
              <div className="academyNodeRewards">
                <div className="academyNodeRewardsLabel">{t("academy.rewards.title")}</div>
                {selectedNode.levels.map((lvl) => (
                  <div
                    key={lvl.level}
                    className={`academyRewardRow${selectedState.currentLevel >= lvl.level ? " earned" : ""}`}
                  >
                    <span className="academyRewardLvlBadge">{t("academy.level")} {lvl.level}</span>
                    {lvl.rewards.map((r, i) => (
                      <span key={i} className="academyRewardChip">{r.description}</span>
                    ))}
                  </div>
                ))}
                {selectedNode.completionReward && (
                  <div className={`academyRewardRow academyRewardRow--completion${selectedState.status === "maxed" ? " earned" : ""}`}>
                    <span className="academyRewardLvlBadge">{t("academy.rewards.completion")}</span>
                    <span className="academyRewardChip">{selectedNode.completionReward.description}</span>
                  </div>
                )}
              </div>

              {selectedState.status !== "maxed" && selectedState.status !== "locked" && (
                <button
                  type="button"
                  className="buttonPrimary academyDonateBtn"
                  onClick={() => {
                    setDonateAmount("");
                    setDonateError(null);
                    setDonateSuccess(null);
                    setDonateModalOpen(true);
                  }}
                >
                  {t("academy.donate.button")}
                </button>
              )}
              {selectedState.status === "maxed" && (
                <div className="academyMaxedBadge">{t("academy.status.maxed")}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Donation history view ── */}
      {view === "history" && (
        <div className="academyHistoryView">
          <h4 className="academyHistoryTitle">{t("academy.views.history")}</h4>
          {historyLoading ? (
            <div className="academyLoading">{t("loading")}</div>
          ) : donations.length === 0 ? (
            <div className="academyEmpty">{t("academy.history.empty")}</div>
          ) : (
            <div className="academyHistoryList">
              {donations.map((d) => (
                <div key={d.id} className="academyHistoryRow">
                  <span className="academyHistoryPlayer">{d.playerName}</span>
                  <span className="academyHistoryNode">{d.nodeId.replace(/_/g, " ")}</span>
                  <span className="academyHistoryAmount">+{formatDucats(d.amount)} {t("currency.ducats")}</span>
                  <span className="academyHistoryDate">{new Date(d.donatedAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Contributions leaderboard ── */}
      {view === "contributions" && (
        <div className="academyContribView">
          <h4 className="academyContribTitle">{t("academy.views.contributions")}</h4>
          {historyLoading ? (
            <div className="academyLoading">{t("loading")}</div>
          ) : contributions.length === 0 ? (
            <div className="academyEmpty">{t("academy.contributions.empty")}</div>
          ) : (
            <div className="academyContribList">
              {contributions.map((c, i) => (
                <div key={c.playerId} className="academyContribRow">
                  <span className="academyContribRank">#{i + 1}</span>
                  <span className="academyContribName">{c.playerName}</span>
                  <span className="academyContribTotal">{formatDucats(c.totalDonated)} {t("currency.ducats")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Donate modal ── */}
      {donateModalOpen && selectedNode && selectedState && (
        <AcademyDonateModal
          node={selectedNode}
          state={selectedState}
          playerDucats={currentDucats.current}
          donating={donating}
          donateError={donateError}
          donateSuccess={donateSuccess}
          donateAmount={donateAmount}
          onAmountChange={(v) => { setDonateAmount(v); setDonateError(null); setDonateSuccess(null); }}
          onSubmit={handleDonate}
          onClose={() => {
            setDonateModalOpen(false);
            setDonateError(null);
            setDonateSuccess(null);
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AcademyNodeCard
// ─────────────────────────────────────────────────────────────────────────────

function AcademyNodeCard({
  node,
  state,
  branch,
  selected,
  onClick
}: {
  node: AcademyNodeConfig;
  state: AcademyNodeState;
  branch?: AcademyBranchConfig;
  selected: boolean;
  onClick: () => void;
}) {
  const pct = node.maxLevel > 0 ? (state.currentLevel / node.maxLevel) * 100 : 0;
  const branchColor = branch?.color ?? "#888";
  const borderColor = selected ? "#fff" : statusBorderColor(state.status);

  return (
    <div
      className="academyNode"
      style={{
        position: "absolute",
        left: node.position.x - NODE_RADIUS,
        top: node.position.y - NODE_RADIUS,
        width: NODE_RADIUS * 2,
        height: NODE_RADIUS * 2,
        background: statusColor(state.status),
        border: `3px solid ${borderColor}`,
        boxShadow: selected ? `0 0 18px 4px ${borderColor}88` : undefined,
        cursor: state.status === "locked" ? "default" : "pointer",
        opacity: state.status === "locked" ? 0.45 : 1
      }}
      onClick={onClick}
      title={node.label}
    >
      {/* Branch colour stripe at the top */}
      <div className="academyNodeStripe" style={{ background: branchColor }} />

      {/* Label chars (abbreviated) */}
      <div className="academyNodeLabel">
        {node.label.split(" ").map((w) => w[0]).join("").slice(0, 3).toUpperCase()}
      </div>

      {/* Level indicator */}
      <div className="academyNodeLevel">
        {state.currentLevel}/{node.maxLevel}
      </div>

      {/* Progress arc (shown when in_progress) */}
      {state.status === "in_progress" && (
        <svg className="academyNodeProgress" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r="40" fill="none" stroke="#ffffff22" strokeWidth="4" />
          <circle
            cx="44" cy="44" r="40"
            fill="none"
            stroke={branchColor}
            strokeWidth="4"
            strokeDasharray={`${pct * 2.513} 251.3`}
            transform="rotate(-90 44 44)"
          />
        </svg>
      )}

      {/* Maxed star */}
      {state.status === "maxed" && (
        <div className="academyNodeMaxed">★</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LevelProgressBar
// ─────────────────────────────────────────────────────────────────────────────

function LevelProgressBar({ node, state }: { node: AcademyNodeConfig; state: AcademyNodeState }) {
  const { t } = useTranslation("common");
  const currentLevelConfig = node.levels[state.currentLevel];
  if (!currentLevelConfig) return null;

  const costForNextLevel = currentLevelConfig.ducatCost;
  // Invested towards CURRENT next level = invested minus cost of all previous levels
  const prevCumulative = node.levels.slice(0, state.currentLevel).reduce((s, l) => s + l.ducatCost, 0);
  const investedTowardsNext = Math.max(0, state.ducatsInvested - prevCumulative);
  const pct = Math.min(100, (investedTowardsNext / costForNextLevel) * 100);

  return (
    <div className="academyNodeProgressBar">
      <div className="academyNodeProgressBarLabel">
        {t("academy.nextLevel")}: {formatDucats(investedTowardsNext)}/{formatDucats(costForNextLevel)}
      </div>
      <div className="academyNodeProgressBarTrack">
        <div className="academyNodeProgressBarFill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AcademyDonateModal
// ─────────────────────────────────────────────────────────────────────────────

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
}) {
  const { t } = useTranslation("common");
  const maxDonatable = state.ducatsToNextLevel !== null
    ? Math.min(playerDucats, state.ducatsToNextLevel)
    : 0;

  return (
    <div className="academyModalOverlay" onClick={onClose}>
      <div className="academyModal" onClick={(e) => e.stopPropagation()}>
        <div className="academyModalHeader">
          <h3>{t("academy.donate.title")}</h3>
          <button type="button" className="academyModalClose" onClick={onClose}>×</button>
        </div>

        <div className="academyModalBody">
          <div className="academyModalNodeName">{node.label}</div>
          <div className="academyModalLevel">
            {t("academy.level")}: {state.currentLevel}/{node.maxLevel}
          </div>
          {state.ducatsToNextLevel !== null && (
            <div className="academyModalToNext">
              {t("academy.toNextLevel")}: <strong>{formatDucats(state.ducatsToNextLevel)}</strong> {t("currency.ducats")}
            </div>
          )}
          <div className="academyModalYourDucats">
            {t("academy.donate.yourDucats")}: <strong>{formatDucats(playerDucats)}</strong>
          </div>

          {donateSuccess ? (
            <div className="academyDonateSuccess">{donateSuccess}</div>
          ) : (
            <>
              <div className="academyDonateInputRow">
                <input
                  type="number"
                  className="academyDonateInput"
                  value={donateAmount}
                  onChange={(e) => onAmountChange(e.target.value)}
                  placeholder={t("academy.donate.amountPlaceholder")}
                  min={1}
                  max={maxDonatable}
                  disabled={donating}
                />
                <button
                  type="button"
                  className="buttonSecondary academyDonateMax"
                  onClick={() => onAmountChange(String(maxDonatable))}
                  disabled={donating || maxDonatable <= 0}
                >
                  {t("academy.donate.max")}
                </button>
              </div>
              {donateError && <div className="academyDonateError">{donateError}</div>}
            </>
          )}
        </div>

        <div className="academyModalFooter">
          {!donateSuccess && (
            <button
              type="button"
              className="buttonPrimary"
              onClick={onSubmit}
              disabled={donating || !donateAmount || parseInt(donateAmount, 10) < 1}
            >
              {donating ? t("academy.donate.donating") : t("academy.donate.confirm")}
            </button>
          )}
          <button type="button" className="buttonSecondary" onClick={onClose}>
            {donateSuccess ? t("close") : t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
