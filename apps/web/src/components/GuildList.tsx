import { useTranslation } from "react-i18next";
import type { Guild } from "@ebonkeep/shared";
import { availableGuildCrestCatalog, GUILD_CREST_COLORS } from "@ebonkeep/shared";

export interface GuildListProps {
  guilds: Guild[];
  onGuildClick?: (guild: Guild) => void;
  onJoinClick?: (guildId: string) => void;
  showJoinButton?: boolean;
}

const crestCatalogById = new Map<string, (typeof availableGuildCrestCatalog)[number]>(availableGuildCrestCatalog.map((entry) => [entry.crestId, entry]));

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
    if (onClick) {
      onClick(guild);
    }
  }

  function handleJoinClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (onJoinClick) {
      onJoinClick(guild.id);
    }
  }

  return (
    <div
      className={`guildListItem ${onClick ? "guildListItem-clickable" : ""}`}
      onClick={handleClick}
    >
      <div className="guildCrestSmall">
        <GuildCrestDisplay
          crestId={guild.crestId}
          bgShape={guild.crestBgShape}
          bgColor={guild.crestBgColor}
          bgPattern={guild.crestBgPattern}
          fgSymbol={guild.crestFgSymbol}
          fgColor={guild.crestFgColor}
          frame={guild.crestFrame}
          alt={guild.name}
        />
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
  bgShape?: string;
  bgColor?: string;
  bgPattern?: string | null;
  fgSymbol?: string;
  fgColor?: string;
  frame?: string | null;
  size?: "small" | "medium" | "large";
  alt?: string;
}

function normalizeLegacyShape(shape?: string) {
  if (!shape) {
    return "shield";
  }
  if (shape.startsWith("shield")) {
    return "shield";
  }
  if (shape.startsWith("circle")) {
    return "circle";
  }
  if (shape.startsWith("banner")) {
    return "banner";
  }
  return shape;
}

function normalizeLegacyPattern(pattern?: string | null) {
  if (!pattern) {
    return null;
  }
  if (pattern === "checkered") {
    return "checkerboard";
  }
  return pattern;
}

function normalizeLegacySymbol(symbol?: string) {
  if (!symbol) {
    return "sword";
  }
  return symbol.replace(/_\d+$/, "");
}

function normalizeLegacyFrame(frame?: string | null) {
  if (!frame) {
    return null;
  }
  return frame.replace(/_\d+$/, "");
}
export function GuildCrestDisplay({
  crestId,
  bgShape,
  bgColor,
  bgPattern,
  fgSymbol,
  fgColor,
  frame,
  size = "small",
  alt = "Guild crest"
}: GuildCrestDisplayProps) {
  const crestAsset = crestId ? crestCatalogById.get(crestId) : undefined;
  const bgColorHex = GUILD_CREST_COLORS[bgColor as keyof typeof GUILD_CREST_COLORS] || "#1A1A1A";
  const fgColorHex = GUILD_CREST_COLORS[fgColor as keyof typeof GUILD_CREST_COLORS] || "#FFFFFF";

  if (crestAsset?.iconPath) {
    return (
      <div className={`guildCrest guildCrest-${size}`}>
        <img className="guildCrestImage" src={crestAsset.iconPath} alt={alt} loading="lazy" />
      </div>
    );
  }

  return (
    <div className={`guildCrest guildCrest-${size}`}>
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <CrestShape shape={normalizeLegacyShape(bgShape)} color={bgColorHex} />
        {normalizeLegacyPattern(bgPattern) ? <CrestPattern pattern={normalizeLegacyPattern(bgPattern)!} color={fgColorHex} opacity={0.2} /> : null}
        <CrestSymbol symbol={normalizeLegacySymbol(fgSymbol)} color={fgColorHex} />
        {normalizeLegacyFrame(frame) ? <CrestFrame frame={normalizeLegacyFrame(frame)!} color={fgColorHex} /> : null}
      </svg>
    </div>
  );
}

function CrestShape({ shape, color }: { shape: string; color: string }) {
  switch (shape) {
    case "shield":
      return <path d="M50 10 L80 30 L80 60 Q80 80 50 90 Q20 80 20 60 L20 30 Z" fill={color} />;
    case "circle":
      return <circle cx="50" cy="50" r="40" fill={color} />;
    case "square":
      return <rect x="15" y="15" width="70" height="70" fill={color} />;
    case "diamond":
      return <path d="M50 10 L90 50 L50 90 L10 50 Z" fill={color} />;
    case "hexagon":
      return <path d="M50 10 L80 30 L80 70 L50 90 L20 70 L20 30 Z" fill={color} />;
    case "banner":
      return <path d="M30 10 L70 10 L70 80 L50 90 L30 80 Z" fill={color} />;
    default:
      return <circle cx="50" cy="50" r="40" fill={color} />;
  }
}

function CrestPattern({ pattern, color, opacity }: { pattern: string; color: string; opacity: number }) {
  switch (pattern) {
    case "stripes":
      return (
        <g opacity={opacity}>
          <rect x="20" y="20" width="10" height="60" fill={color} />
          <rect x="40" y="20" width="10" height="60" fill={color} />
          <rect x="60" y="20" width="10" height="60" fill={color} />
        </g>
      );
    case "checkerboard":
      return (
        <g opacity={opacity}>
          <rect x="20" y="20" width="15" height="15" fill={color} />
          <rect x="50" y="20" width="15" height="15" fill={color} />
          <rect x="35" y="35" width="15" height="15" fill={color} />
          <rect x="65" y="35" width="15" height="15" fill={color} />
          <rect x="20" y="50" width="15" height="15" fill={color} />
          <rect x="50" y="50" width="15" height="15" fill={color} />
          <rect x="35" y="65" width="15" height="15" fill={color} />
          <rect x="65" y="65" width="15" height="15" fill={color} />
        </g>
      );
    case "dots":
      return (
        <g opacity={opacity}>
          <circle cx="30" cy="30" r="3" fill={color} />
          <circle cx="50" cy="30" r="3" fill={color} />
          <circle cx="70" cy="30" r="3" fill={color} />
          <circle cx="30" cy="50" r="3" fill={color} />
          <circle cx="50" cy="50" r="3" fill={color} />
          <circle cx="70" cy="50" r="3" fill={color} />
          <circle cx="30" cy="70" r="3" fill={color} />
          <circle cx="50" cy="70" r="3" fill={color} />
          <circle cx="70" cy="70" r="3" fill={color} />
        </g>
      );
    default:
      return null;
  }
}

function CrestSymbol({ symbol, color }: { symbol: string; color: string }) {
  const centerX = 50;
  const centerY = 50;

  switch (symbol) {
    case "sword":
      return (
        <g fill={color}>
          <rect x={centerX - 2} y={centerY - 15} width="4" height="30" />
          <rect x={centerX - 8} y={centerY + 15} width="16" height="3" />
        </g>
      );
    case "crown":
      return (
        <path
          d={`M${centerX - 15} ${centerY + 5} L${centerX - 10} ${centerY - 5} L${centerX - 5} ${centerY} L${centerX} ${centerY - 10} L${centerX + 5} ${centerY} L${centerX + 10} ${centerY - 5} L${centerX + 15} ${centerY + 5} Z`}
          fill={color}
        />
      );
    case "star":
      return (
        <path
          d={`M${centerX} ${centerY - 15} L${centerX + 4} ${centerY - 5} L${centerX + 15} ${centerY - 3} L${centerX + 7} ${centerY + 4} L${centerX + 10} ${centerY + 15} L${centerX} ${centerY + 8} L${centerX - 10} ${centerY + 15} L${centerX - 7} ${centerY + 4} L${centerX - 15} ${centerY - 3} L${centerX - 4} ${centerY - 5} Z`}
          fill={color}
        />
      );
    case "dragon":
      return <circle cx={centerX} cy={centerY} r="12" fill={color} />;
    case "lion":
      return <circle cx={centerX} cy={centerY} r="12" fill={color} />;
    case "eagle":
      return (
        <path
          d={`M${centerX - 15} ${centerY} Q${centerX} ${centerY - 10} ${centerX + 15} ${centerY} L${centerX + 10} ${centerY + 10} L${centerX} ${centerY + 5} L${centerX - 10} ${centerY + 10} Z`}
          fill={color}
        />
      );
    case "tower":
      return (
        <g fill={color}>
          <rect x={centerX - 10} y={centerY - 12} width="20" height="24" />
          <rect x={centerX - 12} y={centerY - 15} width="5" height="3" />
          <rect x={centerX + 7} y={centerY - 15} width="5" height="3" />
        </g>
      );
    case "flame":
      return (
        <path
          d={`M${centerX} ${centerY - 15} Q${centerX + 8} ${centerY - 8} ${centerX + 5} ${centerY + 5} Q${centerX} ${centerY} ${centerX} ${centerY + 12} Q${centerX} ${centerY} ${centerX - 5} ${centerY + 5} Q${centerX - 8} ${centerY - 8} ${centerX} ${centerY - 15} Z`}
          fill={color}
        />
      );
    default:
      return <circle cx={centerX} cy={centerY} r="10" fill={color} />;
  }
}

function CrestFrame({ frame, color }: { frame: string; color: string }) {
  switch (frame) {
    case "ornate":
      return (
        <g fill="none" stroke={color} strokeWidth="2">
          <circle cx="50" cy="50" r="45" />
          <circle cx="50" cy="50" r="42" />
        </g>
      );
    case "simple":
      return <circle cx="50" cy="50" r="45" fill="none" stroke={color} strokeWidth="2" />;
    case "runic":
      return (
        <g fill="none" stroke={color} strokeWidth="2">
          <path d="M10 50 L20 50 M80 50 L90 50 M50 10 L50 20 M50 80 L50 90" />
          <circle cx="50" cy="50" r="40" />
        </g>
      );
    default:
      return null;
  }
}
