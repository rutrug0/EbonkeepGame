import { useTranslation } from "react-i18next";
import { getGuildCrestById, type Guild } from "@ebonkeep/shared/guild";

export interface GuildListProps {
  guilds: Guild[];
  onGuildClick?: (guild: Guild) => void;
  onJoinClick?: (guildId: string) => void;
  showJoinButton?: boolean;
}

export function GuildList({ guilds, onGuildClick, onJoinClick, showJoinButton = false }: GuildListProps) {
  const { t } = useTranslation("common");

  if (guilds.length === 0) {
    return (
      <div className="guildListEmpty">
        <p>{t("placeholder.guild")}</p>
      </div>
    );
  }

  return (
    <div className="guildList">
      {guilds.map((guild) => (
        <GuildListItem
          key={guild.id}
          guild={guild}
          onClick={onGuildClick}
          onJoinClick={onJoinClick}
          showJoinButton={showJoinButton}
        />
      ))}
    </div>
  );
}

interface GuildListItemProps {
  guild: Guild;
  onClick?: (guild: Guild) => void;
  onJoinClick?: (guildId: string) => void;
  showJoinButton?: boolean;
}

function GuildListItem({ guild, onClick, onJoinClick, showJoinButton }: GuildListItemProps) {
  const { t } = useTranslation("common");

  function handleClick() {
    onClick?.(guild);
  }

  function handleJoinClick(e: React.MouseEvent) {
    e.stopPropagation();
    onJoinClick?.(guild.id);
  }

  return (
    <div
      className={`guildListItem ${onClick ? "guildListItem-clickable" : ""}`}
      onClick={handleClick}
    >
      <div className="guildCrestSmall">
        <GuildCrestDisplay crestId={guild.crestId} />
      </div>

      <div className="guildListItemInfo">
        <div className="guildListItemHeader">
          <span className="guildTag">[{guild.tag}]</span>
          <span className="guildName">{guild.name}</span>
          {guild.isRecruiting && (
            <span className="guildBadge guildBadge-recruiting">
              {t("guild.recruiting")}
            </span>
          )}
        </div>
        <div className="guildListItemStats">
          <span className="guildStat">
            {t("guild.level")}: {guild.level}
          </span>
          <span className="guildStat">
            {t("guild.memberCount")}: {guild.memberCount ?? 0}/{guild.maxMembers}
          </span>
          <span className="guildStat">
            {t("guild.totalPower")}: {guild.totalPower.toLocaleString()}
          </span>
        </div>
        {guild.description && (
          <p className="guildDescription">{guild.description}</p>
        )}
      </div>

      {showJoinButton && guild.isRecruiting && (
        <button
          className="buttonSecondary buttonSmall"
          onClick={handleJoinClick}
        >
          {t("guild.actions.join")}
        </button>
      )}
    </div>
  );
}

interface GuildCrestDisplayProps {
  crestId?: string | null;
  size?: "small" | "medium" | "large";
}

export function GuildCrestDisplay({ crestId, size = "small" }: GuildCrestDisplayProps) {
  const crest = getGuildCrestById(crestId);

  return (
    <div className={`guildCrest guildCrest-${size}`}>
      <img
        className="guildCrestImage"
        src={crest.assetPath}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    </div>
  );
}
