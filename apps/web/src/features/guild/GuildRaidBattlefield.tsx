import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { GuildRaidBossDefinition, GuildRaidEncounter } from "@ebonkeep/shared/guild";

import { ClassIcon } from "../../app/ClassIcon";

type GuildRaidBattlefieldProps = {
  boss: GuildRaidBossDefinition;
  encounter: GuildRaidEncounter | null;
};

type RaidFighter = {
  id: string;
  name: string;
  playerClass: GuildRaidEncounter["participants"][number]["playerClass"];
  level: number;
  power: number;
  maxHp: number;
  currentHp: number;
  isSelf: boolean;
};

type RaidReplayFrame = {
  frontlineIds: Array<string | null>;
  reserveIds: string[];
  fallenIds: string[];
  hpById: Record<string, number>;
  bossHp: number;
  activeActorId: string | null;
  activeTargetId: string | "boss" | null;
  note: string;
  noteKey: string | null;
  noteArgs: Record<string, string | number>;
  isFinished: boolean;
};

const FRONTLINE_SIZE = 5;
const REPLAY_FRAME_MS = 780;

function hashUnitFloat(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 33 + seed.charCodeAt(index)) | 0;
  }
  return ((hash >>> 0) % 10_000) / 10_000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildRaidFighters(encounter: GuildRaidEncounter | null): RaidFighter[] {
  if (!encounter) {
    return [];
  }

  return [...encounter.participants]
    .sort((left, right) => Date.parse(left.joinedAt) - Date.parse(right.joinedAt))
    .map((participant) => {
      const maxHp = clamp(280 + participant.level * 18 + participant.power * 5, 420, 2_400);
      return {
        id: participant.playerId,
        name: participant.playerName,
        playerClass: participant.playerClass,
        level: participant.level,
        power: participant.power,
        maxHp,
        currentHp: maxHp,
        isSelf: participant.isCurrentUser
      };
    });
}

function buildDamageChunks(totalDamage: number, seed: string): number[] {
  if (totalDamage <= 0) {
    return [];
  }

  const chunkCount = clamp(Math.ceil(totalDamage / 450), 1, 7);
  const weights = Array.from({ length: chunkCount }, (_, index) => 0.75 + hashUnitFloat(`${seed}:${index}`));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  let assigned = 0;

  return weights.map((weight, index) => {
    if (index === weights.length - 1) {
      return Math.max(0, totalDamage - assigned);
    }
    const value = Math.max(1, Math.round((totalDamage * weight) / totalWeight));
    assigned += value;
    return value;
  });
}

function buildReplayFrames(args: {
  boss: GuildRaidBossDefinition;
  encounter: GuildRaidEncounter | null;
  t: (key: string, options?: Record<string, unknown>) => string;
}): { fighters: RaidFighter[]; frames: RaidReplayFrame[] } {
  const fighters = buildRaidFighters(args.encounter);
  const initialFrontlineIds: Array<string | null> = fighters.slice(0, FRONTLINE_SIZE).map((fighter) => fighter.id);
  while (initialFrontlineIds.length < FRONTLINE_SIZE) {
    initialFrontlineIds.push(null);
  }

  const initialReserveIds = fighters.slice(FRONTLINE_SIZE).map((fighter) => fighter.id);
  const previewFrame: RaidReplayFrame = {
    frontlineIds: initialFrontlineIds,
    reserveIds: initialReserveIds,
    fallenIds: [],
    hpById: Object.fromEntries(fighters.map((fighter) => [fighter.id, fighter.currentHp])),
    bossHp: args.boss.bossMaxHp,
    activeActorId: null,
    activeTargetId: null,
    note:
      args.encounter?.report
        ? args.t("guild.raids.battlefield.replayReady")
        : args.encounter
          ? args.t("guild.raids.battlefield.frontlineHint")
          : args.t("guild.raids.battlefield.waiting"),
    noteKey: null,
    noteArgs: {},
    isFinished: !args.encounter?.report
  };

  const report = args.encounter?.report;
  if (!report || fighters.length === 0) {
    return { fighters, frames: [previewFrame] };
  }

  const fightersById = new Map(fighters.map((fighter) => [fighter.id, { ...fighter }]));
  const frontlineIds = [...initialFrontlineIds];
  const reserveIds = [...initialReserveIds];
  const fallenIds: string[] = [];
  const rankingById = new Map(report.ranking.map((entry) => [entry.playerId, entry]));
  const pendingDamage = new Map(
    fighters.map((fighter) => [
      fighter.id,
      buildDamageChunks(rankingById.get(fighter.id)?.damageDone ?? 0, `${report.resolvedAt}:${fighter.id}`)
    ])
  );
  const frames: RaidReplayFrame[] = [{ ...previewFrame, isFinished: false }];
  const bossTargetHp = report.bossHpRemaining;
  let bossHp = args.boss.bossMaxHp;
  let allyAttackCount = 0;
  let bossAttackCount = 0;
  let frontlineCursor = 0;

  function pushFrame(frame: Omit<RaidReplayFrame, "frontlineIds" | "reserveIds" | "fallenIds" | "hpById">) {
    frames.push({
      frontlineIds: [...frontlineIds],
      reserveIds: [...reserveIds],
      fallenIds: [...fallenIds],
      hpById: Object.fromEntries(
        [...fightersById.values()].map((fighter) => [fighter.id, fighter.currentHp])
      ),
      ...frame
    });
  }

  function getAliveFrontlineIndexes(): number[] {
    return frontlineIds
      .map((fighterId, index) => ({ fighterId, index }))
      .filter((entry) => {
        if (!entry.fighterId) {
          return false;
        }
        return (fightersById.get(entry.fighterId)?.currentHp ?? 0) > 0;
      })
      .map((entry) => entry.index);
  }

  function pickNextAttackerId(): string | null {
    for (let attempts = 0; attempts < FRONTLINE_SIZE; attempts += 1) {
      const slotIndex = (frontlineCursor + attempts) % FRONTLINE_SIZE;
      const fighterId = frontlineIds[slotIndex];
      if (!fighterId) {
        continue;
      }

      const fighter = fightersById.get(fighterId);
      const nextChunk = pendingDamage.get(fighterId)?.[0] ?? 0;
      if (fighter && fighter.currentHp > 0 && nextChunk > 0) {
        frontlineCursor = (slotIndex + 1) % FRONTLINE_SIZE;
        return fighterId;
      }
    }

    return null;
  }

  for (let step = 0; step < 220; step += 1) {
    const attackerId = pickNextAttackerId();
    if (!attackerId) {
      break;
    }

    const attacker = fightersById.get(attackerId);
    const chunks = pendingDamage.get(attackerId) ?? [];
    const damage = chunks.shift() ?? 0;
    pendingDamage.set(attackerId, chunks);

    if (!attacker || damage <= 0) {
      continue;
    }

    bossHp = Math.max(bossTargetHp, bossHp - damage);
    allyAttackCount += 1;

    pushFrame({
      bossHp,
      activeActorId: attackerId,
      activeTargetId: "boss",
      note: "",
      noteKey: "guild.raids.battlefield.attack",
      noteArgs: { player: attacker.name },
      isFinished: false
    });

    if (bossHp <= bossTargetHp) {
      break;
    }

    if (allyAttackCount % 2 !== 0) {
      continue;
    }

    const aliveFrontlineIndexes = getAliveFrontlineIndexes();
    if (aliveFrontlineIndexes.length === 0) {
      break;
    }

    const targetIndex = aliveFrontlineIndexes[bossAttackCount % aliveFrontlineIndexes.length] ?? aliveFrontlineIndexes[0] ?? 0;
    bossAttackCount += 1;
    const targetId = frontlineIds[targetIndex];
    if (!targetId) {
      continue;
    }

    const target = fightersById.get(targetId);
    if (!target) {
      continue;
    }

    const hitRoll = 0.31 + hashUnitFloat(`${report.resolvedAt}:${targetId}:${bossAttackCount}`) * 0.18;
    const hitDamage = Math.max(
      60,
      Math.round(target.maxHp * hitRoll * (report.outcome === "defeat" ? 1.2 : 1))
    );
    target.currentHp = Math.max(0, target.currentHp - hitDamage);

    pushFrame({
      bossHp,
      activeActorId: "boss",
      activeTargetId: targetId,
      note: "",
      noteKey: "guild.raids.battlefield.bossHit",
      noteArgs: { player: target.name },
      isFinished: false
    });

    if (target.currentHp > 0) {
      continue;
    }

    fallenIds.push(targetId);
    const replacementId = reserveIds.shift() ?? null;
    frontlineIds[targetIndex] = replacementId;

    pushFrame({
      bossHp,
      activeActorId: replacementId,
      activeTargetId: targetId,
      note: replacementId
        ? ""
        : args.t("guild.raids.battlefield.slotDown", { player: target.name }),
      noteKey: replacementId ? "guild.raids.battlefield.replace" : null,
      noteArgs: replacementId
        ? { player: fightersById.get(replacementId)?.name ?? args.t("guild.raids.battlefield.openSlot") }
        : {},
      isFinished: false
    });
  }

  pushFrame({
    bossHp: bossTargetHp,
    activeActorId: report.outcome === "victory" ? "boss" : null,
    activeTargetId: report.outcome === "victory" ? "boss" : null,
    note: report.outcome === "victory" ? args.t("guild.raids.report.victory") : args.t("guild.raids.report.defeat"),
    noteKey: null,
    noteArgs: {},
    isFinished: true
  });

  return { fighters, frames };
}

function RaidUnitCard(props: {
  fighter: RaidFighter | null;
  currentHp: number;
  isHighlighted: boolean;
  isTargeted: boolean;
  emptyLabel: string;
}) {
  if (!props.fighter) {
    return (
      <div className="guildRaidUnitCard guildRaidUnitCard--empty">
        <span>{props.emptyLabel}</span>
      </div>
    );
  }

  const hpPercent = Math.max(0, Math.min(100, Math.round((props.currentHp / props.fighter.maxHp) * 100)));
  const className = [
    "guildRaidUnitCard",
    props.currentHp <= 0 ? "isDown" : "",
    props.isHighlighted ? "isHighlighted" : "",
    props.isTargeted ? "isTargeted" : "",
    props.fighter.isSelf ? "isSelf" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <div className="guildRaidUnitHead">
        <ClassIcon playerClass={props.fighter.playerClass} size={28} alt="" />
        <div>
          <strong>{props.fighter.name}</strong>
          <span>Lv.{props.fighter.level} / {props.fighter.power}</span>
        </div>
      </div>
      <div className="guildRaidUnitHp">
        <div className="guildRaidUnitHpFill" style={{ width: `${hpPercent}%` }} />
        <span>{props.currentHp}/{props.fighter.maxHp}</span>
      </div>
    </div>
  );
}

export function GuildRaidBattlefield({ boss, encounter }: GuildRaidBattlefieldProps) {
  const { t } = useTranslation("common");
  const replayData = useMemo(() => buildReplayFrames({ boss, encounter, t }), [boss, encounter, t]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [replayNonce, setReplayNonce] = useState(0);

  useEffect(() => {
    setFrameIndex(0);
  }, [encounter?.instanceId, encounter?.report?.resolvedAt, replayNonce]);

  useEffect(() => {
    const hasReplay = Boolean(encounter?.report) && replayData.frames.length > 1;
    if (!hasReplay || frameIndex >= replayData.frames.length - 1) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setFrameIndex((current) => Math.min(current + 1, replayData.frames.length - 1));
    }, REPLAY_FRAME_MS);

    return () => window.clearTimeout(timeoutId);
  }, [encounter?.report, frameIndex, replayData.frames.length]);

  const frame = replayData.frames[Math.min(frameIndex, replayData.frames.length - 1)] ?? replayData.frames[0];
  const fightersById = new Map(replayData.fighters.map((fighter) => [fighter.id, fighter]));
  const reservePreview = frame.reserveIds.slice(0, 8).map((fighterId) => fightersById.get(fighterId)).filter(Boolean) as RaidFighter[];
  const statusText = frame.noteKey ? t(frame.noteKey, frame.noteArgs) : frame.note;
  const bossHpPercent = Math.max(0, Math.min(100, Math.round((frame.bossHp / boss.bossMaxHp) * 100)));

  return (
    <section className="guildRaidBattlefieldCard">
      <div className="guildRaidBattlefieldHeader">
        <div>
          <p className="guildRaidEyebrow">{t("guild.raids.battlefield.title")}</p>
          <strong className="guildRaidBattlefieldTitle">{boss.bossName}</strong>
        </div>
        {encounter?.report ? (
          <button
            type="button"
            className="buttonSecondary guildRaidBattlefieldReplay"
            onClick={() => setReplayNonce((value) => value + 1)}
          >
            {t("guild.raids.battlefield.replay")}
          </button>
        ) : null}
      </div>

      <div className="guildRaidBattlefieldStage">
        <div className={`guildRaidBossCard${frame.activeTargetId === "boss" ? " isHit" : ""}`}>
          <div className="guildRaidBossSigil" aria-hidden="true">
            RB
          </div>
          <div className="guildRaidBossCopy">
            <strong>{boss.bossTitle}</strong>
            <span>{boss.zoneName}</span>
          </div>
          <div className="guildRaidBossHp">
            <div className="guildRaidBossHpFill" style={{ width: `${bossHpPercent}%` }} />
            <span>{frame.bossHp}/{boss.bossMaxHp}</span>
          </div>
        </div>

        <div className="guildRaidBattlefieldStatus">
          <strong>{statusText}</strong>
          <span>{t("guild.raids.battlefield.reserve", { count: frame.reserveIds.length })}</span>
        </div>

        <div className="guildRaidFrontlineGrid">
          {frame.frontlineIds.map((fighterId, index) => (
            <RaidUnitCard
              key={`${fighterId ?? "empty"}-${index}`}
              fighter={fighterId ? fightersById.get(fighterId) ?? null : null}
              currentHp={fighterId ? frame.hpById[fighterId] ?? 0 : 0}
              isHighlighted={fighterId !== null && frame.activeActorId === fighterId}
              isTargeted={fighterId !== null && frame.activeTargetId === fighterId}
              emptyLabel={t("guild.raids.battlefield.openSlot")}
            />
          ))}
        </div>
      </div>

      {reservePreview.length > 0 ? (
        <div className="guildRaidReserveStrip">
          {reservePreview.map((fighter) => (
            <div key={fighter.id} className="guildRaidReserveChip">
              <ClassIcon playerClass={fighter.playerClass} size={18} alt="" />
              <span>{fighter.name}</span>
            </div>
          ))}
          {frame.reserveIds.length > reservePreview.length ? (
            <div className="guildRaidReserveChip guildRaidReserveChip--count">
              +{frame.reserveIds.length - reservePreview.length}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
