import {
  DEFAULT_GUILD_CREST_ID,
  GUILD_CREST_CATALOG,
  type GuildCrestId
} from "@ebonkeep/shared";
import { GuildCrestDisplay } from "./GuildList";

export interface GuildCrestEditorProps {
  crestId?: GuildCrestId;
  onChange?: (crestId: GuildCrestId) => void;
}

export function GuildCrestEditor({
  crestId = DEFAULT_GUILD_CREST_ID,
  onChange
}: GuildCrestEditorProps) {
  const activeIndex = Math.max(
    0,
    GUILD_CREST_CATALOG.findIndex((crest) => crest.id === crestId)
  );

  return (
    <div className="guildCrestEditor guildCrestEditorGrid">
      <div className="guildCrestGridCounter">
        {activeIndex + 1}/{GUILD_CREST_CATALOG.length}
      </div>
      <div className="guildCrestGridViewport" aria-live="polite">
        {GUILD_CREST_CATALOG.map((crest, index) => (
          <button
            key={crest.id}
            type="button"
            className={`guildCrestGridItem${index === activeIndex ? " guildCrestGridItem--selected" : ""}`}
            onClick={() => onChange?.(crest.id)}
            aria-pressed={index === activeIndex}
            aria-label={`Select crest ${index + 1}`}
          >
            <GuildCrestDisplay crestId={crest.id} size="large" />
          </button>
        ))}
      </div>
    </div>
  );
}
