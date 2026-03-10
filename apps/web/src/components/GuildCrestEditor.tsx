import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GuildCrestCatalogEntry, GuildCrestId } from "@ebonkeep/shared";
import { availableGuildCrestCatalog, defaultGuildCrestId } from "@ebonkeep/shared";
import { GuildCrestDisplay } from "./GuildList";

export interface GuildCrestEditorProps {
  selectedCrestId?: GuildCrestId | null;
  onChange?: (crestId: GuildCrestId) => void;
}

type CarouselAnimationDirection = "previous" | "next";

const CAROUSEL_ANIMATION_MS = 440;

function wrapIndex(index: number, length: number) {
  return ((index % length) + length) % length;
}

export function GuildCrestEditor({ selectedCrestId, onChange }: GuildCrestEditorProps) {
  const { t } = useTranslation("common");
  const entries: readonly GuildCrestCatalogEntry[] = availableGuildCrestCatalog;
  const initialId = selectedCrestId ?? defaultGuildCrestId;
  const initialIndex = Math.max(0, entries.findIndex((entry) => entry.crestId === initialId));
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [animationDirection, setAnimationDirection] = useState<CarouselAnimationDirection | null>(null);

  useEffect(() => {
    const nextIndex = entries.findIndex((entry) => entry.crestId === (selectedCrestId ?? defaultGuildCrestId));
    if (nextIndex >= 0) {
      setCurrentIndex(nextIndex);
    }
  }, [entries, selectedCrestId]);

  useEffect(() => {
    if (!animationDirection) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setAnimationDirection(null);
    }, CAROUSEL_ANIMATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [animationDirection]);

  if (entries.length === 0) {
    return (
      <div className="guildCrestEditor guildCrestEditor-empty">
        <p className="placeholderText">{t("guild.crest.unavailable")}</p>
      </div>
    );
  }

  const visibleEntries = [-1, 0, 1].map((offset) => entries[wrapIndex(currentIndex + offset, entries.length)]);
  const selectedPosition = currentIndex + 1;

  function commitSelection(nextIndex: number, direction: CarouselAnimationDirection) {
    if (nextIndex === currentIndex) {
      return;
    }

    setAnimationDirection(direction);
    setCurrentIndex(nextIndex);
    onChange?.(entries[nextIndex].crestId as GuildCrestId);
  }

  function move(direction: -1 | 1) {
    const nextIndex = wrapIndex(currentIndex + direction, entries.length);
    commitSelection(nextIndex, direction === -1 ? "previous" : "next");
  }

  function selectCrest(crestId: string) {
    const nextIndex = entries.findIndex((entry) => entry.crestId === crestId);
    if (nextIndex < 0 || nextIndex == currentIndex) {
      return;
    }

    const forwardDistance = wrapIndex(nextIndex - currentIndex, entries.length);
    const backwardDistance = wrapIndex(currentIndex - nextIndex, entries.length);
    commitSelection(nextIndex, forwardDistance <= backwardDistance ? "next" : "previous");
  }

  return (
    <div className="guildCrestEditor">
      <div className="crestCarouselCounter" aria-hidden="true">{selectedPosition}/{entries.length}</div>
      <div className="crestCarousel" aria-label={t("guild.crest.carousel")}>
        <div className={`crestCarouselTrack${animationDirection ? ` crestCarouselTrack-animating-${animationDirection}` : ""}`}>
          {visibleEntries.map((entry, index) => {
            const isSelected = index === 1;
            return (
              <button
                key={`${entry.crestId}-${index}`}
                type="button"
                className={`crestCarouselItem crestCarouselItem-position-${index === 0 ? "left" : index === 1 ? "center" : "right"}${isSelected ? " crestCarouselItem-selected" : ""}`}
                onClick={() => selectCrest(entry.crestId)}
                aria-pressed={isSelected}
              >
                <GuildCrestDisplay crestId={entry.crestId} size={isSelected ? "medium" : "small"} alt={entry.title} />
                <span className="crestCarouselLabel">{entry.title}</span>
              </button>
            );
          })}
        </div>
        <div className="crestCarouselControls">
          <button
            type="button"
            className="crestCarouselArrow"
            onClick={() => move(-1)}
            aria-label={t("guild.crest.previous")}
          >
            &#8249;
          </button>
          <button
            type="button"
            className="crestCarouselArrow"
            onClick={() => move(1)}
            aria-label={t("guild.crest.next")}
          >
            &#8250;
          </button>
        </div>
      </div>
    </div>
  );
}
