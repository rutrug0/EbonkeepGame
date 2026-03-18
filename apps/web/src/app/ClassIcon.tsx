import type { PlayerClass } from "@ebonkeep/shared/core";

const CLASS_ICON_MAP: Record<PlayerClass, string> = {
  juggernaut:  "/assets/class_icons/maul.png",
  sentinel:    "/assets/class_icons/spear.png",
  reaver:      "/assets/class_icons/cleaver.png",
  shade:       "/assets/class_icons/twin_daggers.png",
  arbalist:    "/assets/class_icons/crossbow.png",
  disciple:    "/assets/class_icons/chakram.png",
  runecaster:  "/assets/class_icons/rune.png",
  voidcaster:  "/assets/class_icons/glaive.png",
  arcanist:    "/assets/class_icons/grimoire.png",
};

interface ClassIconProps {
  playerClass: PlayerClass;
  size?: number;
  className?: string;
  alt?: string;
}

export function ClassIcon({ playerClass, size = 24, className, alt = "" }: ClassIconProps) {
  return (
    <img
      src={CLASS_ICON_MAP[playerClass]}
      width={size}
      height={size}
      className={className}
      alt={alt}
      draggable={false}
    />
  );
}
