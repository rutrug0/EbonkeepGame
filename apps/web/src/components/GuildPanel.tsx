import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { GuildMissions } from "./GuildMissions";
import DOMPurify from "dompurify";

// Allowed HTML tags/attrs for guild descriptions
const DESC_PURIFY_CONFIG = {
  ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "s", "span", "br", "small", "big", "h1", "h2", "h3", "p", "div"],
  ALLOWED_ATTR: ["style"],
};

function safeHtml(raw: string): string {
  return String(DOMPurify.sanitize(raw, DESC_PURIFY_CONFIG));
}
import type {
  CreateGuildRequest,
  GuildCrestId,
  GuildDetailsResponse,
  GuildMemberWithPlayer,
  GuildActivityWithDetails,
  Guild,
  GuildMember,
  GuildRole
} from "@ebonkeep/shared";
import { DEFAULT_GUILD_CREST_ID } from "@ebonkeep/shared";
import {
  createGuild,
  getMyGuild,
  getGuildMembers,
  getGuildActivity,
  searchGuilds,
  leaveGuild,
  disbandGuild,
  updateGuild,
  joinGuild,
  getReceivedInvites,
  acceptGuildInvite,
  declineGuildInvite,
  kickMember,
  updateMemberRole,
  transferLeadership,
  sendGuildInvite,
} from "../api";
import { GuildCrestEditor } from "./GuildCrestEditor";
import { GuildCrestDisplay } from "./GuildList";

const GUILD_MIN_LEVEL = 10;

export interface GuildPanelProps {
  token: string | null;
  currentPlayerId?: string | null;
  playerLevel?: number | null;
  playerName?: string | null;
  playerClass?: "warrior" | "mage" | "ranger" | null;
  playerPower?: number | null;
  onActiveMissionChange?: (active: boolean) => void;
}

type GuildView = "myGuild" | "search";
type GuildDetailTab = "members" | "activity" | "invites" | "settings" | "missions";

// ── Shared shield icon ──────────────────────────────────────────────────
function ShieldIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M32 6L6 18V36C6 48 16 57 32 60C48 57 58 48 58 36V18L32 6Z" fill="currentColor" opacity="0.18"/>
      <path d="M32 6L6 18V36C6 48 16 57 32 60C48 57 58 48 58 36V18L32 6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M32 22V42M22 32H42" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

// ── Confirm Modal ───────────────────────────────────────────────────────
interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div className="imperialShopModalOverlay" onClick={onCancel}>
      <div className="imperialShopStatusModal guildConfirmModal" onClick={(e) => e.stopPropagation()}>
        <div className="guildConfirmModalIcon">
          <ShieldIcon size={40} />
        </div>
        <h2 className="guildConfirmModalTitle">{title}</h2>
        <p className="guildConfirmModalMessage">{message}</p>
        <div className="guildConfirmModalActions">
          {cancelLabel && (
            <button
              type="button"
              className="guildConfirmModalBtn guildConfirmModalBtnCancel"
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            className={`guildConfirmModalBtn${danger ? " guildConfirmModalBtnDanger" : " guildConfirmModalBtnConfirm"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Top-Level ────────────────────────────────────────────────────────────
export function GuildPanel({ token, currentPlayerId, playerLevel, playerName, playerClass, playerPower, onActiveMissionChange }: GuildPanelProps) {
  const { t } = useTranslation("common");
  const [currentView, setCurrentView] = useState<GuildView>("myGuild");
  const [hasGuild, setHasGuild] = useState(false);
  const [isActiveMission, setIsActiveMission] = useState(false);

  useEffect(() => {
    if (token) {
      getMyGuild(token)
        .then((data) => setHasGuild(!!data))
        .catch(() => setHasGuild(false));
    }
  }, [token]);

  function handleMissionActiveChange(active: boolean) {
    setIsActiveMission(active);
    onActiveMissionChange?.(active);
  }

  if (!token) {
    return (
      <section className="contentShell guildPanelShell">
        <section className="contentStack guildPanelStack">
          <article className="contentCard">
            <h2>{t("guild.title")}</h2>
            <p>{t("placeholder.guild")}</p>
          </article>
        </section>
      </section>
    );
  }

  // Always keep the same tree structure so MyGuildView/GuildMissions never remount.
  // When a mission is active, we just add height:100% so the travel/combat shells fill the panel.
  return (
    <section
      className="contentShell guildPanelShell"
      style={isActiveMission ? { height: "100%", background: "transparent", border: "none" } : undefined}
    >
      <section
        className="contentStack guildPanelStack"
        style={isActiveMission ? { height: "100%", display: "flex", flexDirection: "column" } : undefined}
      >
        {/* Nav only visible when no active mission — but kept at stable position (index 0) */}
        {!isActiveMission && (
          <article className="contentCard">
            <div className="profileSwitchBar">
              <div className="profileSwitchButtons">
                <button
                  type="button"
                  className={`profileSwitchButton${currentView === "myGuild" ? " active" : ""}`}
                  onClick={() => setCurrentView("myGuild")}
                >
                  {t("guild.myGuild")}
                </button>
                <button
                  type="button"
                  className={`profileSwitchButton${currentView === "search" ? " active" : ""}`}
                  onClick={() => setCurrentView("search")}
                >
                  {t("guild.search")}
                </button>
              </div>
            </div>
          </article>
        )}

        {/* MyGuildView at stable index 1 — never remounts */}
        {currentView === "myGuild" && (
          <MyGuildView
            token={token}
            currentPlayerId={currentPlayerId}
            playerLevel={playerLevel}
            playerName={playerName}
            playerClass={playerClass}
            playerPower={playerPower}
            isActiveMission={isActiveMission}
            onActiveMissionChange={handleMissionActiveChange}
            onSearchClick={() => setCurrentView("search")}
          />
        )}
        {!isActiveMission && currentView === "search" && (
          <article className="contentCard">
            <SearchGuildsView token={token} hasGuild={hasGuild} />
          </article>
        )}
      </section>
    </section>
  );
}

// ── My Guild ──────────────────────────────────────────────────────────────
function MyGuildView({
  token,
  currentPlayerId,
  playerLevel,
  playerName,
  playerClass,
  playerPower,
  isActiveMission = false,
  onActiveMissionChange,
  onSearchClick,
}: {
  token: string;
  currentPlayerId?: string | null;
  playerLevel?: number | null;
  playerName?: string | null;
  playerClass?: "warrior" | "mage" | "ranger" | null;
  playerPower?: number | null;
  isActiveMission?: boolean;
  onActiveMissionChange?: (active: boolean) => void;
  onSearchClick: () => void;
}) {
  const { t } = useTranslation("common");
  const [guildData, setGuildData] = useState<GuildDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeTab, setActiveTab] = useState<GuildDetailTab>("members");
  const [pendingAction, setPendingAction] = useState<"leave" | "disband" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    loadGuildData();
  }, [token]);

  const loadGuildData = async () => {
    try {
      setLoading(true);
      const data = await getMyGuild(token);
      setGuildData(data);
    } catch {
      setGuildData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = () => setPendingAction("leave");
  const handleDisband = () => setPendingAction("disband");

  const handleConfirmAction = async () => {
    if (!guildData?.guild.id || !pendingAction) return;
    setActionError(null);
    try {
      if (pendingAction === "leave") {
        await leaveGuild(token, guildData.guild.id);
      } else {
        await disbandGuild(token, guildData.guild.id);
      }
      setPendingAction(null);
      loadGuildData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
      setPendingAction(null);
    }
  };

  if (loading) {
    return (
      <article className="contentCard">
        <p className="placeholderText">{t("loading")}</p>
      </article>
    );
  }

  if (showCreateForm) {
    return (
      <article className="contentCard guildPanelFillCard">
        <CreateGuildForm
          token={token}
          onSuccess={() => { setShowCreateForm(false); loadGuildData(); }}
          onCancel={() => setShowCreateForm(false)}
        />
      </article>
    );
  }

  if (!guildData?.guild) {
    return (
      <NoGuildView
        token={token}
        playerLevel={playerLevel}
        onCreateClick={() => setShowCreateForm(true)}
        onSearchClick={onSearchClick}
      />
    );
  }

  const role = guildData.currentUserMembership?.role;
  const isLeader = role === "leader";
  const isOfficer = role === "officer";
  const canManage = isLeader || isOfficer;

  const tabs: Array<{ id: GuildDetailTab; label: string; manageOnly?: boolean; leaderOnly?: boolean }> = [
    { id: "members",   label: t("guild.memberList") },
    { id: "activity",  label: t("guild.activityLog") },
    { id: "missions",  label: t("menu.missions") },
    { id: "invites",   label: t("guild.invite.invitesTab"), manageOnly: true },
    { id: "settings",  label: t("guild.settings"), leaderOnly: true },
  ];

  return (
    <>
      {/* ── Guild chrome: hidden while mission is in travel/combat ── */}
      {!isActiveMission && (
        <>
          {/* ── Confirm modal ── */}
          {pendingAction && (
            <ConfirmModal
              title={
                pendingAction === "disband"
                  ? t("guild.actions.disband")
                  : t("guild.actions.leave")
              }
              message={
                pendingAction === "disband"
                  ? t("guild.confirmDisband")
                  : t("guild.confirmLeave")
              }
              confirmLabel={
                pendingAction === "disband"
                  ? t("guild.actions.disband")
                  : t("guild.actions.leave")
              }
              cancelLabel={t("cancel")}
              danger={pendingAction === "disband"}
              onConfirm={handleConfirmAction}
              onCancel={() => setPendingAction(null)}
            />
          )}
          {actionError && (
            <article className="contentCard">
              <p className="guildFormError">{actionError}</p>
            </article>
          )}

          {/* ── Hero banner ── */}
          <article className="contentCard guildHeroBanner">
            <div className="guildHeroCrest">
              <GuildCrestDisplay crestId={guildData.guild.crestId} size="medium" />
            </div>
            <div className="guildHeroBody">
              <h2 className="guildHeroName">
                {guildData.guild.name}
                <span className="guildHeroTag">[{guildData.guild.tag}]</span>
              </h2>
              {guildData.guild.description ? (
                <div
                  className="guildHeroDesc"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: safeHtml(guildData.guild.description) }}
                />
              ) : (
                <p className="guildHeroDesc guildHeroDesc--empty">{t("guild.noDescription")}</p>
              )}
            </div>
            <div className="guildHeroStats">
              <div className="guildHeroStat">
                <span className="guildHeroStatLabel">{t("guild.level")}</span>
                <span className="guildHeroStatValue">{guildData.guild.level}</span>
              </div>
              <div className="guildHeroStat">
                <span className="guildHeroStatLabel">{t("guild.totalPower")}</span>
                <span className="guildHeroStatValue">{guildData.guild.totalPower.toLocaleString()}</span>
              </div>
              <div className="guildHeroStat">
                <span className="guildHeroStatLabel">{t("guild.members")}</span>
                <span className="guildHeroStatValue">{guildData.memberCount}/{guildData.guild.maxMembers}</span>
              </div>
              <div className="guildHeroStat">
                <span className="guildHeroStatLabel">{t("guild.recruiting")}</span>
                <span className={`guildHeroStatusBadge${guildData.guild.isRecruiting ? " guildHeroStatusBadge--open" : " guildHeroStatusBadge--closed"}`}>
                  {guildData.guild.isRecruiting ? t("guild.statusOpen") : t("guild.statusClosed")}
                </span>
              </div>
            </div>
            {!isLeader && (
              <div className="guildHeroLeaveAction">
                <button type="button" className="buttonSecondary" onClick={handleLeave}>
                  {t("guild.actions.leave")}
                </button>
              </div>
            )}
          </article>

          {/* ── Inner tab navigation ── */}
          <article className="contentCard">
            <div className="profileSwitchBar">
              <div className="profileSwitchButtons">
                {tabs
                  .filter((tab) => (!tab.manageOnly || canManage) && (!tab.leaderOnly || isLeader))
                  .map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`profileSwitchButton${activeTab === tab.id ? " active" : ""}`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
              </div>
            </div>
          </article>

          {/* ── Tab content ── */}
          <article className={`contentCard${activeTab === "settings" ? " guildPanelFillCard" : ""}`}>
            {activeTab === "members" && (
              <GuildMembersTab
                token={token}
                guildId={guildData.guild.id}
                currentPlayerId={currentPlayerId}
                currentUserRole={role}
              />
            )}
            {activeTab === "activity" && (
              <GuildActivityTab token={token} guildId={guildData.guild.id} />
            )}
            {activeTab === "invites" && canManage && (
              <GuildInvitesTab token={token} guildId={guildData.guild.id} />
            )}
            {activeTab === "settings" && isLeader && (
              <GuildSettingsTab
                token={token}
                guild={guildData.guild}
                membership={guildData.currentUserMembership}
                canManage={canManage}
                onUpdate={loadGuildData}
                onLeave={handleLeave}
                onDisband={handleDisband}
              />
            )}
          </article>
        </>
      )}
      {/* GuildMissions at stable position — always rendered when missions tab OR mission active */}
      {(activeTab === "missions" || isActiveMission) && (
        <GuildMissions
          playerName={playerName ?? "Warden"}
          playerClass={playerClass ?? "warrior"}
          playerPower={playerPower ?? 80}
          playerLevel={playerLevel ?? 1}
          onActiveMissionChange={onActiveMissionChange}
        />
      )}
    </>
  );
}

// ── No Guild view ─────────────────────────────────────────────────────────
function NoGuildView({
  token,
  playerLevel,
  onCreateClick,
  onSearchClick,
}: {
  token: string;
  playerLevel?: number | null;
  onCreateClick: () => void;
  onSearchClick: () => void;
}) {
  const { t } = useTranslation("common");
  const [invites, setInvites] = useState<any[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [showLevelWarning, setShowLevelWarning] = useState(false);

  const handleCreateClick = () => {
    if (playerLevel != null && playerLevel < GUILD_MIN_LEVEL) {
      setShowLevelWarning(true);
    } else {
      onCreateClick();
    }
  };

  useEffect(() => {
    getReceivedInvites(token)
      .then((data) => setInvites(data.invites || []))
      .catch(() => setInvites([]))
      .finally(() => setLoadingInvites(false));
  }, [token]);

  const handleAccept = async (inviteId: string, guildName: string) => {
    try {
      await acceptGuildInvite(token, inviteId);
      alert(t("guild.invite.accepted", { guildName }));
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to accept invite");
    }
  };

  const handleDecline = async (inviteId: string) => {
    try {
      await declineGuildInvite(token, inviteId);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to decline invite");
    }
  };

  return (
    <>
      {showLevelWarning && (
        <ConfirmModal
          title={t("guild.createLevelRequiredTitle", { level: GUILD_MIN_LEVEL })}
          message={t("guild.createLevelRequired", { level: GUILD_MIN_LEVEL })}
          confirmLabel={t("cancel")}
          cancelLabel=""
          onConfirm={() => setShowLevelWarning(false)}
          onCancel={() => setShowLevelWarning(false)}
        />
      )}
      <article className="contentCard noGuildHeroCard">
        <div className="noGuildHeroCrest">
          <ShieldIcon size={64} />
        </div>
        <h2 className="noGuildHeroTitle">{t("guild.noGuildHero")}</h2>
        <p className="noGuildHeroSubtitle">{t("guild.noGuildSubtitle")}</p>
        {playerLevel != null && playerLevel < GUILD_MIN_LEVEL && (
          <p className="noGuildLevelHint">{t("guild.createLevelRequired", { level: GUILD_MIN_LEVEL })}</p>
        )}
        <div className="noGuildHeroActions">
          <button
            type="button"
            className="guildFormButton guildFormButtonPrimary"
            onClick={handleCreateClick}
          >
            {t("guild.create")}
          </button>
          <button
            type="button"
            className="guildFormButton guildFormButtonSecondary"
            onClick={onSearchClick}
          >
            {t("guild.actions.join")}
          </button>
        </div>
      </article>

      <article className="contentCard">
        <h3 className="guildSectionTitle">{t("guild.pendingInvites")}</h3>
        {loadingInvites ? (
          <p className="placeholderText">{t("loading")}</p>
        ) : invites.length === 0 ? (
          <p className="placeholderText">{t("guild.invite.noInvites")}</p>
        ) : (
          <div className="guildInvitesList">
            {invites.map((invite) => (
              <div key={invite.id} className="guildInviteItem">
                <div className="guildInviteInfo">
                  <h4 className="guildInviteGuildName">
                    [{invite.guild?.tag}] {invite.guild?.name}
                  </h4>
                  {invite.message && (
                    <p className="guildInviteMessage">"{invite.message}"</p>
                  )}
                  <div className="guildInviteMeta">
                    <span>{t("guild.invite.from")}: {invite.inviter?.account?.username ?? "Unknown"}</span>
                    <span>{t("guild.invite.expires")}: {new Date(invite.expiresAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="guildInviteActions">
                  <button
                    type="button"
                    className="buttonPrimary"
                    onClick={() => handleAccept(invite.id, invite.guild?.name ?? "Guild")}
                  >
                    {t("guild.invite.accept")}
                  </button>
                  <button
                    type="button"
                    className="buttonSecondary"
                    onClick={() => handleDecline(invite.id)}
                  >
                    {t("guild.invite.decline")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </>
  );
}

// ── Search Guilds ─────────────────────────────────────────────────────────
function GuildListCard({
  guild,
  hasGuild,
  onView,
  onJoin,
  joining,
}: {
  guild: Guild;
  hasGuild: boolean;
  onView: () => void;
  onJoin: () => void;
  joining: boolean;
}) {
  const { t } = useTranslation("common");
  // Strip HTML tags for the preview snippet
  const plainDesc = guild.description
    ? guild.description.replace(/<[^>]*>/g, "").trim()
    : "";
  return (
    <div
      className="guildListCard"
      onClick={onView}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onView()}
    >
      <div className="guildListCardCrest">
        <ShieldIcon size={40} />
      </div>
      <div className="guildListCardBody">
        <div className="guildListCardTitle">
          <span className="guildTag">[{guild.tag}]</span>
          <span className="guildListCardName">{guild.name}</span>
          {guild.isRecruiting ? (
            <span className="guildHeroStatusBadge guildHeroStatusBadge--open">
              {t("guild.statusOpen")}
            </span>
          ) : (
            <span className="guildHeroStatusBadge guildHeroStatusBadge--closed">
              {t("guild.statusClosed")}
            </span>
          )}
        </div>
        {plainDesc && <p className="guildListCardDesc">{plainDesc}</p>}
        <div className="guildListCardStats">
          <span>
            {t("guild.level")}: <strong>{guild.level}</strong>
          </span>
          <span>
            {t("guild.members")}: <strong>{(guild.memberCount ?? 0)}/{guild.maxMembers}</strong>
          </span>
          <span>
            {t("guild.power")}: <strong>{guild.totalPower?.toLocaleString() ?? 0}</strong>
          </span>
        </div>
      </div>
      <div
        className="guildListCardActions"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="buttonGhost buttonSmall"
          onClick={onView}
        >
          {t("guild.viewDetails")}
        </button>
        {guild.isRecruiting && !hasGuild && (
          <button
            type="button"
            className="buttonPrimary buttonSmall"
            onClick={onJoin}
            disabled={joining}
          >
            {joining ? t("loading") : t("guild.actions.join")}
          </button>
        )}
      </div>
    </div>
  );
}

function GuildDetailView({
  guild,
  hasGuild,
  onBack,
  onJoin,
  joining,
  joinError,
}: {
  guild: Guild;
  hasGuild: boolean;
  onBack: () => void;
  onJoin: () => void;
  joining: boolean;
  joinError: string | null;
}) {
  const { t } = useTranslation("common");
  return (
    <div className="guildDetailView">
      <div className="guildDetailHeader">
        <button type="button" className="buttonGhost" onClick={onBack}>
          ← {t("guild.backToResults")}
        </button>
      </div>
      <div className="guildDetailHero">
        <div className="guildDetailCrest">
          <ShieldIcon size={64} />
        </div>
        <div className="guildDetailInfo">
          <div className="guildDetailTitleRow">
            <span className="guildTag guildTagLarge">[{guild.tag}]</span>
            <span className="guildDetailName">{guild.name}</span>
          </div>
          <div className="guildDetailStatusRow">
            {guild.isRecruiting ? (
              <span className="guildHeroStatusBadge guildHeroStatusBadge--open">
                {t("guild.statusOpen")}
              </span>
            ) : (
              <span className="guildHeroStatusBadge guildHeroStatusBadge--closed">
                {t("guild.statusClosed")}
              </span>
            )}
          </div>
          <div className="guildDetailStats">
            <div className="guildDetailStat">
              <span className="guildDetailStatLabel">{t("guild.level")}</span>
              <span className="guildDetailStatValue">{guild.level}</span>
            </div>
            <div className="guildDetailStat">
              <span className="guildDetailStatLabel">{t("guild.members")}</span>
              <span className="guildDetailStatValue">
                {guild.memberCount ?? 0}/{guild.maxMembers}
              </span>
            </div>
            <div className="guildDetailStat">
              <span className="guildDetailStatLabel">{t("guild.power")}</span>
              <span className="guildDetailStatValue">
                {guild.totalPower?.toLocaleString() ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {guild.description ? (
        <div
          className="guildDetailDesc"
          dangerouslySetInnerHTML={{ __html: safeHtml(guild.description) }}
        />
      ) : (
        <p className="guildDetailDesc guildDetailDesc--empty">
          {t("guild.noDescription")}
        </p>
      )}

      {joinError && <p className="formError">{joinError}</p>}

      <div className="guildDetailActions">
        {hasGuild ? (
          <p className="guildSearchHint guildSearchHint--warn">
            {t("guild.alreadyInGuildHint")}
          </p>
        ) : guild.isRecruiting ? (
          <button
            type="button"
            className="buttonPrimary"
            onClick={onJoin}
            disabled={joining}
          >
            {joining ? t("loading") : t("guild.actions.join")}
          </button>
        ) : (
          <p className="placeholderText">{t("guild.notRecruiting")}</p>
        )}
      </div>
    </div>
  );
}

function SearchGuildsView({
  token,
  hasGuild,
}: {
  token: string;
  hasGuild: boolean;
}) {
  const { t } = useTranslation("common");
  const [searchQuery, setSearchQuery] = useState("");
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [total, setTotal] = useState(0);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null);
  const [pendingJoinGuild, setPendingJoinGuild] = useState<Guild | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const LIMIT = 20;

  useEffect(() => {
    loadGuilds(true);
  }, []);

  const loadGuilds = async (reset: boolean) => {
    const newOffset = reset ? 0 : currentOffset + LIMIT;
    if (reset) setLoading(true);
    else setLoadingMore(true);
    try {
      const params: Parameters<typeof searchGuilds>[1] = {
        limit: LIMIT,
        offset: newOffset,
      };
      if (searchQuery.trim()) params.name = searchQuery.trim();
      const results = await searchGuilds(token, params);
      if (reset) {
        setGuilds(results.guilds);
        setCurrentOffset(0);
      } else {
        setGuilds((prev) => [...prev, ...results.guilds]);
        setCurrentOffset(newOffset);
      }
      setTotal(results.total);
    } catch {
      // silently handle empty/error state
    } finally {
      if (reset) setLoading(false);
      else setLoadingMore(false);
    }
  };

  const handleSearch = () => {
    setSelectedGuild(null);
    loadGuilds(true);
  };

  const handleJoinConfirm = async () => {
    if (!pendingJoinGuild) return;
    setJoiningId(pendingJoinGuild.id);
    setJoinError(null);
    try {
      await joinGuild(token, pendingJoinGuild.id);
      setPendingJoinGuild(null);
      window.location.reload();
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Failed to join guild");
      setJoiningId(null);
      setPendingJoinGuild(null);
    }
  };

  const handleViewGuild = (guild: Guild) => {
    setJoinError(null);
    setSelectedGuild(guild);
  };

  const confirmModal = pendingJoinGuild ? (
    <ConfirmModal
      title={t("guild.actions.join")}
      message={t("guild.confirmJoin", { guildName: pendingJoinGuild.name })}
      confirmLabel={t("guild.actions.join")}
      cancelLabel={t("cancel")}
      onConfirm={handleJoinConfirm}
      onCancel={() => {
        setPendingJoinGuild(null);
        setJoinError(null);
      }}
    />
  ) : null;

  if (selectedGuild) {
    return (
      <div className="guildViewContent">
        {confirmModal}
        <GuildDetailView
          guild={selectedGuild}
          hasGuild={hasGuild}
          onBack={() => setSelectedGuild(null)}
          onJoin={() => setPendingJoinGuild(selectedGuild)}
          joining={joiningId === selectedGuild.id}
          joinError={joinError}
        />
      </div>
    );
  }

  return (
    <div className="guildViewContent">
      {confirmModal}
      <div className="guildSearchBar">
        <input
          type="text"
          placeholder={t("guild.searchPlaceholder")}
          className="guildSearchInput"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <button
          type="button"
          className="buttonPrimary"
          onClick={handleSearch}
          disabled={loading}
        >
          {loading ? t("loading") : t("guild.search")}
        </button>
      </div>

      {hasGuild && (
        <p className="guildSearchHint guildSearchHint--warn">
          {t("guild.alreadyInGuildHint")}
        </p>
      )}

      {loading && <p className="placeholderText">{t("loading")}</p>}

      {!loading && guilds.length === 0 && (
        <p className="placeholderText">{t("guild.noSearchResults")}</p>
      )}

      {!loading && guilds.length > 0 && (
        <>
          <p className="guildSearchCount">
            {t("guild.guildCount", { count: total })}
          </p>
          <div className="guildList">
            {guilds.map((guild) => (
              <GuildListCard
                key={guild.id}
                guild={guild}
                hasGuild={hasGuild}
                onView={() => handleViewGuild(guild)}
                onJoin={() => setPendingJoinGuild(guild)}
                joining={joiningId === guild.id}
              />
            ))}
          </div>
          {guilds.length < total && (
            <div className="guildLoadMore">
              <button
                type="button"
                className="buttonSecondary"
                onClick={() => loadGuilds(false)}
                disabled={loadingMore}
              >
                {loadingMore ? t("loading") : t("guild.loadMore")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Create Guild Form ─────────────────────────────────────────────────────
function CreateGuildForm({
  token,
  onSuccess,
  onCancel,
}: {
  token: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation("common");
  const [formData, setFormData] = useState<CreateGuildRequest>({
    name: "",
    tag: "",
    description: "",
    crestId: DEFAULT_GUILD_CREST_ID,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createGuild(token, formData);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create guild");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="guildCreateFormWrapper">
      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit} className="guildCreateFormContent">
        <div className="guildCreatePreview">
          <div className="guildCreatePreviewCrest">
            <GuildCrestDisplay crestId={formData.crestId} size="large" />
          </div>
          <div className="guildCreatePreviewBody">
            <div className="guildCreatePreviewName">
              {formData.name.trim() || t("guild.namePlaceholder")}
            </div>
            <div className="guildCreatePreviewTag">
              [{formData.tag.trim() || "TAG"}]
            </div>
          </div>
        </div>

        <div className="guildCreateFormFields">
          <div className="guildFormField">
            <label htmlFor="guildName" className="guildFormLabel">
              {t("guild.name")}
              <span className="guildFormLabelHint">{t("guild.nameHint")}</span>
            </label>
            <input
              id="guildName"
              type="text"
              className="guildFormInput"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              minLength={3}
              maxLength={32}
              required
              placeholder={t("guild.namePlaceholder")}
            />
          </div>

          <div className="guildFormField">
            <label htmlFor="guildTag" className="guildFormLabel">
              {t("guild.tag")}
              <span className="guildFormLabelHint">{t("guild.tagHint")}</span>
            </label>
            <input
              id="guildTag"
              type="text"
              className="guildFormInput guildFormInputTag"
              value={formData.tag}
              onChange={(e) => setFormData({ ...formData, tag: e.target.value.toUpperCase() })}
              minLength={2}
              maxLength={6}
              required
              placeholder="TAG"
            />
          </div>

          <div className="guildFormField guildFormFieldFull guildDescriptionWithCrest">
            <div className="guildDescriptionEditorBlock">
              <GuildDescEditor
                value={formData.description ?? ""}
                onChange={(html) => setFormData({ ...formData, description: html })}
              />
            </div>
            <div className="guildDescriptionCrestBlock">
              <GuildCrestEditor
                crestId={formData.crestId}
                onChange={(crestId) => setFormData({ ...formData, crestId })}
              />
            </div>
          </div>
        </div>

        <div className="guildCreateFormActions">
          <button type="submit" className="guildFormButton guildFormButtonPrimary" disabled={submitting}>
            {submitting ? t("loading") : t("guild.create")}
          </button>
          <button type="button" className="guildFormButton guildFormButtonSecondary" onClick={onCancel} disabled={submitting}>
            {t("cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Guild Members Tab ─────────────────────────────────────────────────────
type MemberAction = "kick" | "promote" | "demote" | "transfer";
interface PendingMemberAction {
  type: MemberAction;
  playerId: string;
  username: string;
}

function GuildMembersTab({
  token,
  guildId,
  currentPlayerId,
  currentUserRole,
}: {
  token: string;
  guildId: string;
  currentPlayerId?: string | null;
  currentUserRole?: GuildRole;
}) {
  const { t } = useTranslation("common");
  const [members, setMembers] = useState<GuildMemberWithPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<PendingMemberAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    loadMembers();
  }, [token, guildId]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const data = await getGuildMembers(token, guildId);
      setMembers(data.members);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    setActionError(null);
    try {
      if (pendingAction.type === "kick") {
        await kickMember(token, guildId, pendingAction.playerId);
      } else if (pendingAction.type === "promote") {
        await updateMemberRole(token, guildId, pendingAction.playerId, "officer");
      } else if (pendingAction.type === "demote") {
        await updateMemberRole(token, guildId, pendingAction.playerId, "member");
      } else if (pendingAction.type === "transfer") {
        await transferLeadership(token, guildId, pendingAction.playerId);
      }
      setPendingAction(null);
      await loadMembers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
      setPendingAction(null);
    }
  };

  const getModalProps = (action: PendingMemberAction) => {
    const { type, username } = action;
    const titleMap: Record<MemberAction, string> = {
      kick: t("guild.actions.kick"),
      promote: t("guild.actions.promote"),
      demote: t("guild.actions.demote"),
      transfer: t("guild.actions.transferLeadership"),
    };
    const messageMap: Record<MemberAction, string> = {
      kick: t("guild.confirmKick", { player: username }),
      promote: t("guild.confirmPromote", { player: username }),
      demote: t("guild.confirmDemote", { player: username }),
      transfer: t("guild.confirmTransfer", { player: username }),
    };
    return {
      title: titleMap[type],
      message: messageMap[type],
      confirmLabel: titleMap[type],
      danger: type === "kick" || type === "transfer",
    };
  };

  if (loading) return <div className="guildTabLoading"><p>{t("loading")}</p></div>;
  if (!members.length) return <div className="guildTabEmpty"><p>{t("guild.noMembers")}</p></div>;

  const isLeader = currentUserRole === "leader";
  const canManage = isLeader || currentUserRole === "officer";

  const roleOrder: Record<string, number> = { leader: 0, officer: 1, member: 2 };
  const sorted = [...members].sort((a, b) => (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3));

  const modalProps = pendingAction ? getModalProps(pendingAction) : null;

  return (
    <div className="guildRosterWrap">
      {pendingAction && modalProps && (
        <ConfirmModal
          title={modalProps.title}
          message={modalProps.message}
          confirmLabel={modalProps.confirmLabel}
          cancelLabel={t("cancel")}
          danger={modalProps.danger}
          onConfirm={handleConfirmAction}
          onCancel={() => setPendingAction(null)}
        />
      )}
      {actionError && <p className="guildFormError">{actionError}</p>}
      {sorted.map((member) => {
        const isMe = member.playerId === currentPlayerId;
        const username = member.player.account.username ?? `#${member.playerId.slice(0, 8)}`;
        const canKick = canManage && !isMe && member.role !== "leader" &&
          !(currentUserRole === "officer" && member.role === "officer");
        const canPromote = isLeader && !isMe && member.role === "member";
        const canDemote = isLeader && !isMe && member.role === "officer";
        const canTransfer = isLeader && !isMe;

        return (
          <div key={member.id} className="guildRosterCard">
            <div className="guildRosterAvatar">
              <span className="guildRosterAvatarInitial">{username.charAt(0).toUpperCase()}</span>
            </div>
            <div className="guildRosterInfo">
              <div className="guildRosterNameRow">
                <span className="guildRosterName">{username}</span>
                {isMe && <span className="guildRosterYou">({t("you")})</span>}
                <span className={`guildRoleBadge guildRoleBadge--${member.role}`}>
                  {t(`guild.role.${member.role}`)}
                </span>
              </div>
              <div className="guildRosterMeta">
                <span className="guildRosterClass">{t(`class.${member.player.class}`)}</span>
                <span className="guildRosterStatPill">{t("guild.level")} {member.player.level}</span>
                <span className="guildRosterStatPill">{t("guild.power")} {member.contributedPower.toLocaleString()}</span>
              </div>
            </div>
            {(canPromote || canDemote || canTransfer || canKick) && (
              <div className="guildRosterActions">
                {canPromote && (
                  <button type="button" className="buttonSmall" onClick={() => setPendingAction({ type: "promote", playerId: member.playerId, username })}>
                    {t("guild.actions.promote")}
                  </button>
                )}
                {canDemote && (
                  <button type="button" className="buttonSmall" onClick={() => setPendingAction({ type: "demote", playerId: member.playerId, username })}>
                    {t("guild.actions.demote")}
                  </button>
                )}
                {canTransfer && (
                  <button type="button" className="buttonSmall buttonPrimary" onClick={() => setPendingAction({ type: "transfer", playerId: member.playerId, username })}>
                    {t("guild.actions.transferLeadership")}
                  </button>
                )}
                {canKick && (
                  <button type="button" className="buttonSmall buttonDanger" onClick={() => setPendingAction({ type: "kick", playerId: member.playerId, username })}>
                    {t("guild.actions.kick")}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Guild Activity Tab ────────────────────────────────────────────────────
function GuildActivityTab({ token, guildId }: { token: string; guildId: string }) {
  const { t } = useTranslation("common");
  const [activities, setActivities] = useState<GuildActivityWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGuildActivity(token, guildId)
      .then((data) => setActivities(data.activities))
      .catch(() => setActivities([]))
      .finally(() => setLoading(false));
  }, [token, guildId]);

  if (loading) return <div className="guildTabLoading"><p>{t("loading")}</p></div>;
  if (!activities.length) return <div className="guildTabEmpty"><p>{t("guild.noActivity")}</p></div>;

  const DOT_CLASS: Record<string, string> = {
    joined: "join", created: "join",
    left: "leave", kicked: "leave",
    promoted: "promote", transferred_leadership: "promote",
    demoted: "demote",
    invited: "invite", updated: "invite", description_changed: "invite",
    disbanded: "leave",
  };

  return (
    <div className="guildTimeline">
      {activities.map((activity) => {
        const dot = DOT_CLASS[activity.actionType] ?? "default";
        const actorName = activity.actor?.account.username ?? t("unknown");
        const targetName = activity.target?.account.username ?? "";
        const text = t(`guild.activity.${activity.actionType}`, { actor: actorName, target: targetName });

        return (
          <div key={activity.id} className="guildTimelineItem">
            <div className={`guildTimelineDot guildTimelineDot--${dot}`} />
            <div className="guildTimelineBody">
              <p className="guildTimelineText">{text}</p>
              <span className="guildTimelineTime">{new Date(activity.timestamp).toLocaleString()}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Guild Invites Tab (officers/leaders) ──────────────────────────────────
function GuildInvitesTab({ token, guildId }: { token: string; guildId: string }) {
  const { t } = useTranslation("common");
  const [invitePlayerId, setInvitePlayerId] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitePlayerId.trim()) {
      alert(t("guild.invite.error.playerIdRequired"));
      return;
    }
    try {
      setSending(true);
      await sendGuildInvite(token, guildId, invitePlayerId, inviteMessage || undefined);
      alert(t("guild.invite.success.sent"));
      setInvitePlayerId("");
      setInviteMessage("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="guildInviteTabContent">
      <h3 className="guildSectionTitle">{t("guild.invite.sendInvitation")}</h3>
      <form onSubmit={handleSend} className="guildInviteSendForm">
        <div className="guildInviteSendFields">
          <div className="guildFormGroup">
            <label htmlFor="invitePlayerId" className="guildFormLabel">
              {t("guild.invite.playerIdOrUsername")}
            </label>
            <input
              id="invitePlayerId"
              type="text"
              className="guildFormInput"
              value={invitePlayerId}
              onChange={(e) => setInvitePlayerId(e.target.value)}
              placeholder={t("guild.invite.playerIdPlaceholder")}
              disabled={sending}
            />
          </div>
          <div className="guildFormGroup">
            <label htmlFor="inviteMessage" className="guildFormLabel">
              {t("guild.invite.messageOptional")}
            </label>
            <input
              id="inviteMessage"
              type="text"
              className="guildFormInput"
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              placeholder={t("guild.invite.messagePlaceholder")}
              maxLength={200}
              disabled={sending}
            />
          </div>
        </div>
        <div className="guildInviteSendActions">
          <button
            type="submit"
            className="buttonPrimary"
            disabled={sending || !invitePlayerId.trim()}
          >
            {sending ? t("loading") : t("guild.invite.send")}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Guild Settings Tab ────────────────────────────────────────────────────
// ── Guild Description Rich-Text Editor ──────────────────────────────────
function GuildDescEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const { t } = useTranslation("common");
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = () => {
    onChange(editorRef.current?.innerHTML ?? "");
  };

  // Prevent toolbar button clicks from stealing caret from editor
  const noBlur = (e: React.MouseEvent) => e.preventDefault();

  const cmd = (command: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    onChange(editorRef.current?.innerHTML ?? "");
  };

  const wrapInline = (tag: "small" | "big") => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const el = document.createElement(tag);
    el.appendChild(range.extractContents());
    range.insertNode(el);
    sel.removeAllRanges();
    onChange(editorRef.current?.innerHTML ?? "");
  };

  // Paste as plain text only – prevents injecting external HTML
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  return (
    <div className="guildDescEditor">
      <div className="guildDescToolbar">
        {/* Heading group */}
        <button type="button" className="guildDescToolbarBtn" onMouseDown={noBlur} onClick={() => cmd("formatBlock", "H1")} title={t("guild.editor.h1")}>H1</button>
        <button type="button" className="guildDescToolbarBtn" onMouseDown={noBlur} onClick={() => cmd("formatBlock", "H2")} title={t("guild.editor.h2")}>H2</button>
        <button type="button" className="guildDescToolbarBtn" onMouseDown={noBlur} onClick={() => cmd("formatBlock", "H3")} title={t("guild.editor.h3")}>H3</button>
        <button type="button" className="guildDescToolbarBtn" onMouseDown={noBlur} onClick={() => cmd("formatBlock", "P")} title={t("guild.editor.paragraph")}>&#182;</button>
        <span className="guildDescToolbarSep" />
        {/* Style group */}
        <button type="button" className="guildDescToolbarBtn guildDescToolbarBtnBold" onMouseDown={noBlur} onClick={() => cmd("bold")} title={t("guild.editor.bold")}>B</button>
        <button type="button" className="guildDescToolbarBtn guildDescToolbarBtnItalic" onMouseDown={noBlur} onClick={() => cmd("italic")} title={t("guild.editor.italic")}>I</button>
        <span className="guildDescToolbarSep" />
        {/* Font size group */}
        <button type="button" className="guildDescToolbarBtn" onMouseDown={noBlur} onClick={() => wrapInline("small")} title={t("guild.editor.sizeSmall")}>{t("guild.editor.small")}</button>
        <button type="button" className="guildDescToolbarBtn" onMouseDown={noBlur} onClick={() => cmd("removeFormat")} title={t("guild.editor.sizeNormal")}>{t("guild.editor.normal")}</button>
        <button type="button" className="guildDescToolbarBtn" onMouseDown={noBlur} onClick={() => wrapInline("big")} title={t("guild.editor.sizeLarge")}>{t("guild.editor.large")}</button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="guildDescEditorArea"
        data-placeholder={t("guild.descriptionPlaceholder")}
        onInput={handleInput}
        onPaste={handlePaste}
      />
    </div>
  );
}

function GuildSettingsTab({
  token,
  guild,
  membership,
  canManage,
  onUpdate,
  onLeave,
  onDisband,
}: {
  token: string;
  guild: Guild;
  membership: GuildMember | null;
  canManage: boolean;
  onUpdate: () => void;
  onLeave: () => void;
  onDisband: () => void;
}) {
  const { t } = useTranslation("common");
  const isLeader = membership?.role === "leader";
  const [formData, setFormData] = useState({
    description: guild.description || "",
    isRecruiting: guild.isRecruiting,
    crestId: guild.crestId ?? DEFAULT_GUILD_CREST_ID,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFormData({
      description: guild.description || "",
      isRecruiting: guild.isRecruiting,
      crestId: guild.crestId ?? DEFAULT_GUILD_CREST_ID,
    });
  }, [guild.crestId, guild.description, guild.isRecruiting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await updateGuild(token, guild.id, formData);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update guild");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="guildSettingsTab">
      {/* ── Read-only info ── */}
      <div className="guildInfoSection">
        <h3 className="guildSectionTitle">{t("guild.guildInfo")}</h3>
        <div className="guildInfoGrid">
          <div className="guildInfoItem">
            <span className="guildInfoLabel">{t("guild.createdAt")}</span>
            <span className="guildInfoValue">{new Date(guild.createdAt).toLocaleDateString()}</span>
          </div>
          {membership && (
            <div className="guildInfoItem">
              <span className="guildInfoLabel">{t("guild.joinedAt")}</span>
              <span className="guildInfoValue">{new Date(membership.joinedAt).toLocaleDateString()}</span>
            </div>
          )}
          <div className="guildInfoItem">
            <span className="guildInfoLabel">{t("guild.recruiting")}</span>
            <span className={`guildHeroStatusBadge${guild.isRecruiting ? " guildHeroStatusBadge--open" : " guildHeroStatusBadge--closed"}`}>
              {guild.isRecruiting ? t("guild.statusOpen") : t("guild.statusClosed")}
            </span>
          </div>
        </div>
      </div>

      {/* ── Editable settings (managers only) ── */}
      {canManage && (
        <form onSubmit={handleSubmit} className="guildSettingsForm">
          <h3 className="guildSectionTitle">{t("guild.settings")}</h3>
          <div className="guildFormGroup guildDescriptionWithCrest">
            <div className="guildDescriptionEditorBlock">
              <GuildDescEditor
                value={formData.description}
                onChange={(html) => setFormData({ ...formData, description: html })}
              />
            </div>
            <div className="guildDescriptionCrestBlock">
              <GuildCrestEditor
                crestId={formData.crestId as GuildCrestId}
                onChange={(crestId) => setFormData({ ...formData, crestId })}
              />
            </div>
          </div>

          <div className="guildFormGroup">
            <label className="guildFormCheckboxLabel">
              <input
                type="checkbox"
                checked={formData.isRecruiting}
                onChange={(e) => setFormData({ ...formData, isRecruiting: e.target.checked })}
                className="guildFormCheckbox"
              />
              <span>{t("guild.openRecruitment")}</span>
            </label>
          </div>

          {error && <div className="guildFormError">{error}</div>}

          <div className="guildFormActions">
            <button type="submit" className="buttonPrimary" disabled={submitting}>
              {submitting ? t("loading") : t("save")}
            </button>
          </div>
        </form>
      )}

      {/* ── Management actions (visible to all) ── */}
      <div className="guildActionsSection">
        <h3 className="guildSectionTitle">{t("guild.management")}</h3>
        <div className="guildActionButtons">
          {isLeader ? (
            <button type="button" className="buttonDanger" onClick={onDisband}>
              {t("guild.actions.disband")}
            </button>
          ) : (
            <button type="button" className="buttonSecondary" onClick={onLeave}>
              {t("guild.actions.leave")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
