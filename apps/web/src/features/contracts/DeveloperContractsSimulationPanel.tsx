import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import {
  allPlayerClasses,
  type PlayerClass
} from "@ebonkeep/shared/core";
import {
  type ContractLevelBand,
  type DeveloperContractsStaticCurvePoint,
  type DeveloperContractsStaticCurvesResponse,
  type DeveloperContractSimulationArchetype,
  type DeveloperContractSimulationArchetypeResult,
  type DeveloperContractSimulationJob,
  type DeveloperContractSimulationLevelSummary
} from "@ebonkeep/shared/combat";

import {
  fetchDeveloperContractSimulation,
  fetchDeveloperContractsStaticCurves,
  runDeveloperContractSimulation
} from "./api";

type DeveloperContractsSimulationPanelProps = {
  token: string;
  initialPlayerClass: PlayerClass;
};

type DeveloperContractSimulationJobView = DeveloperContractSimulationJob & {
  artifactPath?: string | null;
};

type ChartMetricKind = "duration" | "percentage" | "number" | "days";

type LevelChartRow = {
  level: number;
  active: number;
  average: number;
  slow: number;
};

type StaticLevelChartRow = {
  level: number;
  value: number;
};

const ARCHETYPE_COLORS: Record<DeveloperContractSimulationArchetype, string> = {
  active: "#f28539",
  average: "#7aa37a",
  slow: "#5f87a3"
};

const LEVEL_BAND_COLORS: Record<ContractLevelBand, string> = {
  under_level: "#6f8d5f",
  on_level: "#c49143",
  over_level: "#b85a4e"
} as const;

const BENCHMARK_HP_LOSS_TARGETS: Record<ContractLevelBand, { min: number; max: number }> = {
  under_level: { min: 25, max: 35 },
  on_level: { min: 35, max: 45 },
  over_level: { min: 50, max: 60 }
};

function formatDuration(value: number): string {
  if (value <= 0) {
    return "0m";
  }

  const totalMinutes = Math.round(value / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const totalHours = value / 3600;
  if (totalHours < 24) {
    return `${totalHours.toFixed(totalHours >= 10 ? 0 : 1)}h`;
  }

  const days = Math.floor(totalHours / 24);
  const hours = Math.round(totalHours % 24);
  return hours === 0 ? `${days}d` : `${days}d ${hours}h`;
}

function formatMetricValue(value: number, kind: ChartMetricKind): string {
  if (kind === "duration") {
    return formatDuration(value);
  }
  if (kind === "days") {
    return `${value.toFixed(value >= 100 ? 0 : 1)}d`;
  }
  if (kind === "percentage") {
    return `${value.toFixed(0)}%`;
  }
  return value.toFixed(value >= 100 ? 0 : 1);
}

function buildArchetypeRows(
  results: DeveloperContractSimulationArchetypeResult[],
  valueGetter: (level: DeveloperContractSimulationLevelSummary) => number
): LevelChartRow[] {
  const activeLevels = results.find((entry) => entry.archetype === "active")?.levels ?? [];
  const averageLevels = results.find((entry) => entry.archetype === "average")?.levels ?? [];
  const slowLevels = results.find((entry) => entry.archetype === "slow")?.levels ?? [];

  return activeLevels.map((level, index) => ({
    level: level.level,
    active: valueGetter(level),
    average: valueGetter(averageLevels[index] ?? level),
    slow: valueGetter(slowLevels[index] ?? level)
  }));
}

function buildCumulativeArchetypeRows(
  results: DeveloperContractSimulationArchetypeResult[],
  valueGetter: (level: DeveloperContractSimulationLevelSummary) => number
): LevelChartRow[] {
  const cumulative = {
    active: 0,
    average: 0,
    slow: 0
  };

  return buildArchetypeRows(results, (level) => valueGetter(level)).map((row) => {
    cumulative.active += row.active;
    cumulative.average += row.average;
    cumulative.slow += row.slow;
    return {
      level: row.level,
      active: cumulative.active,
      average: cumulative.average,
      slow: cumulative.slow
    };
  });
}

function buildStaticRows(
  levels: DeveloperContractsStaticCurvePoint[],
  valueGetter: (level: DeveloperContractsStaticCurvePoint) => number
): StaticLevelChartRow[] {
  return levels.map((level) => ({
    level: level.level,
    value: valueGetter(level)
  }));
}

function summarizeArchetype(result: DeveloperContractSimulationArchetypeResult) {
  const totalElapsedSeconds = result.levels.reduce((sum, level) => sum + level.avgElapsedSecondsToClearLevel, 0);
  const totalActiveSeconds = result.levels.reduce((sum, level) => sum + level.avgActivePlaySecondsToClearLevel, 0);
  const totalIdleSeconds = result.levels.reduce((sum, level) => sum + level.avgIdleSecondsToClearLevel, 0);
  const finalLevel = result.levels[result.levels.length - 1];

  return {
    totalElapsedSeconds,
    totalActiveSeconds,
    totalIdleSeconds,
    finalGearScore: finalLevel?.gearScore ?? 0,
    finalOverLevelWinRate: finalLevel?.winRateByBand.over_level ?? 0,
    finalCompletionRate: finalLevel?.completionRate ?? 0,
    benchmarkTargetBandHitRateByBand: result.benchmarkTargetBandHitRateByBand
  };
}

function MetricChart(props: {
  title: string;
  description: string;
  data: LevelChartRow[];
  kind: ChartMetricKind;
  testId: string;
}) {
  const { t } = useTranslation();

  return (
    <article className="contentCard developerSimulationChartCard" data-testid={props.testId}>
      <div className="developerSimulationChartHeader">
        <div>
          <h4>{props.title}</h4>
          <p>{props.description}</p>
        </div>
      </div>
      <div className="developerSimulationChartBody">
        <ResponsiveContainer width="100%" height={320}>
          <RechartsLineChart data={props.data} margin={{ top: 16, right: 20, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="rgba(186, 166, 131, 0.12)" strokeDasharray="4 4" />
            <XAxis
              dataKey="level"
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              label={{ value: t("settings.simulation.levelAxis"), position: "insideBottom", offset: -2, fill: "var(--text-muted)" }}
            />
            <YAxis
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              tickFormatter={(value) => formatMetricValue(Number(value), props.kind)}
              label={{
                value: props.description,
                angle: -90,
                position: "insideLeft",
                fill: "var(--text-muted)"
              }}
            />
            <Tooltip
              formatter={(value, name) => [formatMetricValue(Number(value ?? 0), props.kind), String(name)]}
              labelFormatter={(value) => `${t("player.level", { value })}`}
              contentStyle={{
                background: "rgba(18, 25, 32, 0.96)",
                border: "1px solid rgba(186, 166, 131, 0.2)",
                borderRadius: "10px",
                color: "var(--text-main)"
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="active" name={t("settings.simulation.archetypes.active")} stroke={ARCHETYPE_COLORS.active} strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="average" name={t("settings.simulation.archetypes.average")} stroke={ARCHETYPE_COLORS.average} strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="slow" name={t("settings.simulation.archetypes.slow")} stroke={ARCHETYPE_COLORS.slow} strokeWidth={3} dot={false} />
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function StaticMetricChart(props: {
  title: string;
  description: string;
  data: StaticLevelChartRow[];
  kind: ChartMetricKind;
  lineColor?: string;
  testId: string;
}) {
  const { t } = useTranslation();

  return (
    <article className="contentCard developerSimulationChartCard" data-testid={props.testId}>
      <div className="developerSimulationChartHeader">
        <div>
          <h4>{props.title}</h4>
          <p>{props.description}</p>
        </div>
      </div>
      <div className="developerSimulationChartBody">
        <ResponsiveContainer width="100%" height={320}>
          <RechartsLineChart data={props.data} margin={{ top: 16, right: 20, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="rgba(186, 166, 131, 0.12)" strokeDasharray="4 4" />
            <XAxis
              dataKey="level"
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              label={{ value: t("settings.simulation.levelAxis"), position: "insideBottom", offset: -2, fill: "var(--text-muted)" }}
            />
            <YAxis
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              tickFormatter={(value) => formatMetricValue(Number(value), props.kind)}
              label={{
                value: props.description,
                angle: -90,
                position: "insideLeft",
                fill: "var(--text-muted)"
              }}
            />
            <Tooltip
              formatter={(value) => [formatMetricValue(Number(value ?? 0), props.kind), props.title]}
              labelFormatter={(value) => `${t("player.level", { value })}`}
              contentStyle={{
                background: "rgba(18, 25, 32, 0.96)",
                border: "1px solid rgba(186, 166, 131, 0.2)",
                borderRadius: "10px",
                color: "var(--text-main)"
              }}
            />
            <Line type="monotone" dataKey="value" name={props.title} stroke={props.lineColor ?? "#d8a14f"} strokeWidth={3} dot={false} />
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function StaticLevelBandChart(props: {
  title: string;
  description: string;
  data: DeveloperContractsStaticCurvePoint[];
  testId: string;
}) {
  const { t } = useTranslation();
  const rows = props.data.map((level) => ({
    level: level.level,
    under_level: level.averageExperiencePerContract.under_level,
    on_level: level.averageExperiencePerContract.on_level,
    over_level: level.averageExperiencePerContract.over_level
  }));

  return (
    <article className="contentCard developerSimulationChartCard" data-testid={props.testId}>
      <div className="developerSimulationChartHeader">
        <div>
          <h4>{props.title}</h4>
          <p>{props.description}</p>
        </div>
      </div>
      <div className="developerSimulationChartBody">
        <ResponsiveContainer width="100%" height={320}>
          <RechartsLineChart data={rows} margin={{ top: 16, right: 20, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="rgba(186, 166, 131, 0.12)" strokeDasharray="4 4" />
            <XAxis
              dataKey="level"
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              label={{ value: t("settings.simulation.levelAxis"), position: "insideBottom", offset: -2, fill: "var(--text-muted)" }}
            />
            <YAxis
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              tickFormatter={(value) => formatMetricValue(Number(value), "number")}
              label={{
                value: props.description,
                angle: -90,
                position: "insideLeft",
                fill: "var(--text-muted)"
              }}
            />
            <Tooltip
              formatter={(value, name) => [formatMetricValue(Number(value ?? 0), "number"), String(name)]}
              labelFormatter={(value) => `${t("player.level", { value })}`}
              contentStyle={{
                background: "rgba(18, 25, 32, 0.96)",
                border: "1px solid rgba(186, 166, 131, 0.2)",
                borderRadius: "10px",
                color: "var(--text-main)"
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="under_level" name={t("contracts.levelBandUnderLevel")} stroke={LEVEL_BAND_COLORS.under_level} strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="on_level" name={t("contracts.levelBandOnLevel")} stroke={LEVEL_BAND_COLORS.on_level} strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="over_level" name={t("contracts.levelBandOverLevel")} stroke={LEVEL_BAND_COLORS.over_level} strokeWidth={3} dot={false} />
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function LevelBandWinRateChart(props: {
  archetype: DeveloperContractSimulationArchetype;
  levels: DeveloperContractSimulationLevelSummary[];
  title: string;
}) {
  const { t } = useTranslation();
  const data = props.levels.map((level) => ({
    level: level.level,
    under_level: level.winRateByBand.under_level * 100,
    on_level: level.winRateByBand.on_level * 100,
    over_level: level.winRateByBand.over_level * 100
  }));

  return (
    <article className="contentCard developerSimulationChartCard" data-testid={`developer-sim-level-band-${props.archetype}`}>
      <div className="developerSimulationChartHeader">
        <div>
          <h4>{props.title}</h4>
          <p>{t("settings.simulation.winRateAxis")}</p>
        </div>
      </div>
      <div className="developerSimulationChartBody">
        <ResponsiveContainer width="100%" height={320}>
          <RechartsLineChart data={data} margin={{ top: 16, right: 20, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="rgba(186, 166, 131, 0.12)" strokeDasharray="4 4" />
            <XAxis
              dataKey="level"
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              label={{ value: t("settings.simulation.levelAxis"), position: "insideBottom", offset: -2, fill: "var(--text-muted)" }}
            />
            <YAxis
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              tickFormatter={(value) => `${value}%`}
              label={{
                value: t("settings.simulation.winRateAxis"),
                angle: -90,
                position: "insideLeft",
                fill: "var(--text-muted)"
              }}
            />
            <Tooltip
              formatter={(value, name) => [`${Number(value ?? 0).toFixed(0)}%`, String(name)]}
              labelFormatter={(value) => `${t("player.level", { value })}`}
              contentStyle={{
                background: "rgba(18, 25, 32, 0.96)",
                border: "1px solid rgba(186, 166, 131, 0.2)",
                borderRadius: "10px",
                color: "var(--text-main)"
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="under_level" name={t("contracts.levelBandUnderLevel")} stroke={LEVEL_BAND_COLORS.under_level} strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="on_level" name={t("contracts.levelBandOnLevel")} stroke={LEVEL_BAND_COLORS.on_level} strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="over_level" name={t("contracts.levelBandOverLevel")} stroke={LEVEL_BAND_COLORS.over_level} strokeWidth={3} dot={false} />
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function BenchmarkLevelBandChart(props: {
  title: string;
  description: string;
  data: LevelChartRow[];
  levelBand: ContractLevelBand;
  testId: string;
}) {
  const { t } = useTranslation();
  const targetBand = BENCHMARK_HP_LOSS_TARGETS[props.levelBand];

  return (
    <article className="contentCard developerSimulationChartCard" data-testid={props.testId}>
      <div className="developerSimulationChartHeader">
        <div>
          <h4>{props.title}</h4>
          <p>{props.description}</p>
        </div>
      </div>
      <div className="developerSimulationChartBody">
        <ResponsiveContainer width="100%" height={320}>
          <RechartsLineChart data={props.data} margin={{ top: 16, right: 20, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="rgba(186, 166, 131, 0.12)" strokeDasharray="4 4" />
            <ReferenceArea
              y1={targetBand.min}
              y2={targetBand.max}
              fill={LEVEL_BAND_COLORS[props.levelBand]}
              fillOpacity={0.14}
              ifOverflow="extendDomain"
            />
            <XAxis
              dataKey="level"
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              label={{ value: t("settings.simulation.levelAxis"), position: "insideBottom", offset: -2, fill: "var(--text-muted)" }}
            />
            <YAxis
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              tickFormatter={(value) => formatMetricValue(Number(value), "percentage")}
              label={{
                value: props.description,
                angle: -90,
                position: "insideLeft",
                fill: "var(--text-muted)"
              }}
            />
            <Tooltip
              formatter={(value, name) => [formatMetricValue(Number(value ?? 0), "percentage"), String(name)]}
              labelFormatter={(value) => `${t("player.level", { value })}`}
              contentStyle={{
                background: "rgba(18, 25, 32, 0.96)",
                border: "1px solid rgba(186, 166, 131, 0.2)",
                borderRadius: "10px",
                color: "var(--text-main)"
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="active" name={t("settings.simulation.archetypes.active")} stroke={ARCHETYPE_COLORS.active} strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="average" name={t("settings.simulation.archetypes.average")} stroke={ARCHETYPE_COLORS.average} strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="slow" name={t("settings.simulation.archetypes.slow")} stroke={ARCHETYPE_COLORS.slow} strokeWidth={3} dot={false} />
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

export function DeveloperContractsSimulationPanel(props: DeveloperContractsSimulationPanelProps) {
  const { t } = useTranslation();
  const [selectedClass, setSelectedClass] = useState<PlayerClass>(props.initialPlayerClass);
  const [job, setJob] = useState<DeveloperContractSimulationJobView | null>(null);
  const [staticCurves, setStaticCurves] = useState<DeveloperContractsStaticCurvesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [staticCurvesError, setStaticCurvesError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const startLockRef = useRef(false);

  useEffect(() => {
    void fetchDeveloperContractsStaticCurves(props.token)
      .then((response) => {
        setStaticCurves(response);
        setStaticCurvesError(null);
      })
      .catch((nextError: unknown) => {
        setStaticCurvesError(nextError instanceof Error ? nextError.message : t("settings.simulation.staticCurvesLoadFailed"));
      });
  }, [props.token, t]);

  useEffect(() => {
    if (!job || (job.status !== "queued" && job.status !== "running")) {
      return;
    }

    const interval = window.setInterval(() => {
      void fetchDeveloperContractSimulation(props.token, job.jobId)
        .then((nextJob) => {
          setJob(nextJob);
          setError(null);
        })
        .catch((nextError: unknown) => {
          setError(nextError instanceof Error ? nextError.message : t("settings.simulation.loadFailed"));
        });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [job, props.token, t]);

  const result = job?.result;
  const archetypeSummaries = useMemo(() => {
    if (!result) {
      return [];
    }

    return result.archetypes.map((entry) => ({
      archetype: entry.archetype,
      metrics: summarizeArchetype(entry)
    }));
  }, [result]);

  const elapsedRows = useMemo(
    () => result ? buildArchetypeRows(result.archetypes, (level) => level.avgElapsedSecondsToClearLevel) : [],
    [result]
  );
  const cumulativeElapsedDaysRows = useMemo(
    () => result ? buildCumulativeArchetypeRows(result.archetypes, (level) => level.avgElapsedSecondsToClearLevel / 86_400) : [],
    [result]
  );
  const idleRows = useMemo(
    () => result ? buildArchetypeRows(result.archetypes, (level) => level.avgIdleSecondsToClearLevel) : [],
    [result]
  );
  const activeRows = useMemo(
    () => result ? buildArchetypeRows(result.archetypes, (level) => level.avgActivePlaySecondsToClearLevel) : [],
    [result]
  );
  const staminaWaitRows = useMemo(
    () => result ? buildArchetypeRows(result.archetypes, (level) => level.avgStaminaWaitSecondsToClearLevel) : [],
    [result]
  );
  const contractAvailabilityWaitRows = useMemo(
    () => result ? buildArchetypeRows(result.archetypes, (level) => level.avgContractAvailabilityWaitSecondsToClearLevel) : [],
    [result]
  );
  const fightsRows = useMemo(
    () => result ? buildArchetypeRows(result.archetypes, (level) => level.avgFightsToClearLevel) : [],
    [result]
  );
  const gearRows = useMemo(
    () => result ? buildArchetypeRows(result.archetypes, (level) => level.gearScore) : [],
    [result]
  );
  const completionRows = useMemo(
    () => result ? buildArchetypeRows(result.archetypes, (level) => level.completionRate * 100) : [],
    [result]
  );
  const playerAttackRollRows = useMemo(
    () => result ? buildArchetypeRows(result.archetypes, (level) => level.avgPlayerAttackRoll) : [],
    [result]
  );
  const playerHpLossRows = useMemo(
    () => result ? buildArchetypeRows(result.archetypes, (level) => level.avgPlayerHpLossPercent) : [],
    [result]
  );
  const benchmarkEasyHpLossRows = useMemo(
    () => result ? buildArchetypeRows(result.archetypes, (level) => level.avgPlayerHpLossPercentByBand.under_level) : [],
    [result]
  );
  const benchmarkMediumHpLossRows = useMemo(
    () => result ? buildArchetypeRows(result.archetypes, (level) => level.avgPlayerHpLossPercentByBand.on_level) : [],
    [result]
  );
  const benchmarkHardHpLossRows = useMemo(
    () => result ? buildArchetypeRows(result.archetypes, (level) => level.avgPlayerHpLossPercentByBand.over_level) : [],
    [result]
  );
  const staticTravelRows = useMemo(
    () => staticCurves ? buildStaticRows(staticCurves.levels, (level) => level.averageTravelSeconds) : [],
    [staticCurves]
  );
  const staticReplenishRows = useMemo(
    () => staticCurves ? buildStaticRows(staticCurves.levels, (level) => level.averageReplenishSeconds) : [],
    [staticCurves]
  );
  const staticStaminaWaitRows = useMemo(
    () => staticCurves ? buildStaticRows(staticCurves.levels, (level) => level.averageStaminaWaitSecondsForContract) : [],
    [staticCurves]
  );
  const staticContractWaitRows = useMemo(
    () => staticCurves ? buildStaticRows(staticCurves.levels, (level) => level.averageContractAvailabilityWaitSeconds) : [],
    [staticCurves]
  );
  const staticXpRequiredRows = useMemo(
    () => staticCurves ? buildStaticRows(staticCurves.levels, (level) => level.experienceToNextLevel) : [],
    [staticCurves]
  );

  const statusText = useMemo(() => {
    if (!job) {
      return t("settings.simulation.idle");
    }
    if (job.status === "queued") {
      return t("settings.simulation.starting");
    }
    if (job.status === "failed") {
      return job.error ?? t("settings.simulation.failed");
    }
    if (job.status === "completed") {
      return t("settings.simulation.completed");
    }
    return t("settings.simulation.runningStatus", {
      archetype: job.progress.currentArchetype ? t(`settings.simulation.archetypes.${job.progress.currentArchetype}`) : "-",
      level: job.progress.currentLevel ?? "-",
      sample: job.progress.currentSampleIndex ?? "-"
    });
  }, [job, t]);

  const hasActiveJob = isStarting || job?.status === "queued" || job?.status === "running";
  const progressPercent = job
    ? Math.round((job.progress.completedSamples / Math.max(job.progress.totalSamples, 1)) * 100)
    : 0;

  async function handleRunSimulation() {
    if (startLockRef.current || hasActiveJob) {
      return;
    }

    try {
      startLockRef.current = true;
      setIsStarting(true);
      setError(null);
      const nextJob = await runDeveloperContractSimulation(props.token, {
        playerClass: selectedClass,
        sampleSize: 200
      });
      setJob(nextJob);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t("settings.simulation.startFailed"));
    } finally {
      startLockRef.current = false;
      setIsStarting(false);
    }
  }

  return (
    <article className="contentCard" data-testid="developer-contracts-simulation-panel">
      <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 320px" }}>
          <h3 style={{ marginTop: 0, marginBottom: "6px" }}>{t("settings.simulation.title")}</h3>
          <p style={{ marginTop: 0, color: "var(--text-muted)", fontSize: "14px" }}>{t("settings.simulation.description")}</p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <label htmlFor="developer-sim-class" style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            {t("settings.simulation.classLabel")}
          </label>
          <select
            id="developer-sim-class"
            value={selectedClass}
            onChange={(event) => setSelectedClass(event.currentTarget.value as PlayerClass)}
            disabled={hasActiveJob}
          >
            {allPlayerClasses.map((playerClass) => (
              <option key={playerClass} value={playerClass}>
                {t(`class.${playerClass}`)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void handleRunSimulation()}
            disabled={hasActiveJob}
            style={{
              padding: "10px 18px",
              borderRadius: "8px",
              border: "1px solid rgba(242, 133, 57, 0.35)",
              background: "rgba(242, 133, 57, 0.12)",
              color: "#f28539",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            {isStarting ? t("settings.simulation.starting") : t("settings.simulation.run")}
          </button>
        </div>
      </div>

      <div style={{ marginTop: "16px", display: "grid", gap: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", fontSize: "13px" }}>
          <span>{statusText}</span>
          {job ? (
            <span>
              {job.progress.completedSamples}/{job.progress.totalSamples}
            </span>
          ) : null}
        </div>
        <div
          style={{
            height: "10px",
            borderRadius: "999px",
            background: "rgba(186, 166, 131, 0.14)",
            overflow: "hidden"
          }}
        >
          <div
            style={{
              width: `${progressPercent}%`,
              height: "100%",
              background: "linear-gradient(90deg, #f28539 0%, #d8a14f 100%)",
              transition: "width 160ms ease"
            }}
          />
        </div>
        {job?.artifactPath ? (
          <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
            {t("settings.simulation.artifactPathLabel")}: <code>{job.artifactPath}</code>
          </p>
        ) : null}
        {error ? <p style={{ margin: 0, color: "#b85a4e" }}>{error}</p> : null}
      </div>

      {result ? (
        <section style={{ marginTop: "20px", display: "grid", gap: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
            {archetypeSummaries.map((entry) => (
              <article
                key={entry.archetype}
                style={{
                  borderRadius: "10px",
                  border: `1px solid ${ARCHETYPE_COLORS[entry.archetype]}33`,
                  background: `${ARCHETYPE_COLORS[entry.archetype]}14`,
                  padding: "14px"
                }}
              >
                <h4 style={{ margin: "0 0 10px", color: ARCHETYPE_COLORS[entry.archetype] }}>
                  {t(`settings.simulation.archetypes.${entry.archetype}`)}
                </h4>
                <p style={{ margin: "0 0 6px", fontSize: "13px" }}>
                  {t("settings.simulation.totalElapsedTime")}: {formatDuration(entry.metrics.totalElapsedSeconds)}
                </p>
                <p style={{ margin: "0 0 6px", fontSize: "13px" }}>
                  {t("settings.simulation.totalIdleTime")}: {formatDuration(entry.metrics.totalIdleSeconds)}
                </p>
                <p style={{ margin: "0 0 6px", fontSize: "13px" }}>
                  {t("settings.simulation.totalActiveTime")}: {formatDuration(entry.metrics.totalActiveSeconds)}
                </p>
                <p style={{ margin: "0 0 6px", fontSize: "13px" }}>
                  {t("currencies.gearScore")}: {entry.metrics.finalGearScore.toLocaleString()}
                </p>
                <p style={{ margin: "0 0 6px", fontSize: "13px" }}>
                  {t("settings.simulation.finalCompletionRate")}: {(entry.metrics.finalCompletionRate * 100).toFixed(0)}%
                </p>
                <p style={{ margin: "0 0 6px", fontSize: "13px" }}>
                  {t("settings.simulation.benchmarkTargetBandHitRateLabel", {
                    band: t("contracts.levelBandUnderLevel")
                  })}: {(entry.metrics.benchmarkTargetBandHitRateByBand.under_level * 100).toFixed(0)}%
                </p>
                <p style={{ margin: "0 0 6px", fontSize: "13px" }}>
                  {t("settings.simulation.benchmarkTargetBandHitRateLabel", {
                    band: t("contracts.levelBandOnLevel")
                  })}: {(entry.metrics.benchmarkTargetBandHitRateByBand.on_level * 100).toFixed(0)}%
                </p>
                <p style={{ margin: "0 0 6px", fontSize: "13px" }}>
                  {t("settings.simulation.benchmarkTargetBandHitRateLabel", {
                    band: t("contracts.levelBandOverLevel")
                  })}: {(entry.metrics.benchmarkTargetBandHitRateByBand.over_level * 100).toFixed(0)}%
                </p>
                <p style={{ margin: 0, fontSize: "13px" }}>
                  {t("settings.simulation.finalOverLevelWinRate")}: {(entry.metrics.finalOverLevelWinRate * 100).toFixed(0)}%
                </p>
              </article>
            ))}
          </div>

          <section style={{ display: "grid", gap: "12px" }}>
            <div>
              <h4 style={{ margin: "0 0 6px" }}>{t("settings.simulation.benchmarkSectionTitle")}</h4>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "14px" }}>
                {t("settings.simulation.benchmarkSectionDescription")}
              </p>
            </div>
            <div className="developerSimulationChartsGrid">
              <BenchmarkLevelBandChart
                title={t("settings.simulation.benchmarkUnderLevelChartTitle")}
                description={t("settings.simulation.benchmarkUnderLevelAxis")}
                data={benchmarkEasyHpLossRows}
                levelBand="under_level"
                testId="developer-sim-benchmark-hp-loss-under-level-chart"
              />
              <BenchmarkLevelBandChart
                title={t("settings.simulation.benchmarkOnLevelChartTitle")}
                description={t("settings.simulation.benchmarkOnLevelAxis")}
                data={benchmarkMediumHpLossRows}
                levelBand="on_level"
                testId="developer-sim-benchmark-hp-loss-on-level-chart"
              />
              <BenchmarkLevelBandChart
                title={t("settings.simulation.benchmarkOverLevelChartTitle")}
                description={t("settings.simulation.benchmarkOverLevelAxis")}
                data={benchmarkHardHpLossRows}
                levelBand="over_level"
                testId="developer-sim-benchmark-hp-loss-over-level-chart"
              />
            </div>
          </section>

          <div className="developerSimulationChartsGrid">
            <MetricChart
              title={t("settings.simulation.elapsedChartTitle")}
              description={t("settings.simulation.elapsedAxis")}
              data={elapsedRows}
              kind="duration"
              testId="developer-sim-elapsed-chart"
            />

            <MetricChart
              title={t("settings.simulation.cumulativeElapsedChartTitle")}
              description={t("settings.simulation.cumulativeElapsedAxis")}
              data={cumulativeElapsedDaysRows}
              kind="days"
              testId="developer-sim-cumulative-elapsed-chart"
            />

            <MetricChart
              title={t("settings.simulation.idleChartTitle")}
              description={t("settings.simulation.idleAxis")}
              data={idleRows}
              kind="duration"
              testId="developer-sim-idle-chart"
            />

            <MetricChart
              title={t("settings.simulation.activeChartTitle")}
              description={t("settings.simulation.activeAxis")}
              data={activeRows}
              kind="duration"
              testId="developer-sim-active-chart"
            />

            <MetricChart
              title={t("settings.simulation.staminaWaitChartTitle")}
              description={t("settings.simulation.staminaWaitAxis")}
              data={staminaWaitRows}
              kind="duration"
              testId="developer-sim-stamina-wait-chart"
            />

            <MetricChart
              title={t("settings.simulation.contractWaitChartTitle")}
              description={t("settings.simulation.contractWaitAxis")}
              data={contractAvailabilityWaitRows}
              kind="duration"
              testId="developer-sim-contract-wait-chart"
            />

            <MetricChart
              title={t("settings.simulation.fightsChartTitle")}
              description={t("settings.simulation.fightsAxis")}
              data={fightsRows}
              kind="number"
              testId="developer-sim-fights-chart"
            />

            <MetricChart
              title={t("settings.simulation.completionChartTitle")}
              description={t("settings.simulation.completionAxis")}
              data={completionRows}
              kind="percentage"
              testId="developer-sim-completion-chart"
            />

            <MetricChart
              title={t("settings.simulation.gearChartTitle")}
              description={t("settings.simulation.gearAxis")}
              data={gearRows}
              kind="number"
              testId="developer-sim-gear-chart"
            />

            <MetricChart
              title={t("settings.simulation.playerAttackRollChartTitle")}
              description={t("settings.simulation.playerAttackRollAxis")}
              data={playerAttackRollRows}
              kind="number"
              testId="developer-sim-player-attack-roll-chart"
            />

            <MetricChart
              title={t("settings.simulation.playerHpLossChartTitle")}
              description={t("settings.simulation.playerHpLossAxis")}
              data={playerHpLossRows}
              kind="percentage"
              testId="developer-sim-player-hp-loss-chart"
            />

            {result.archetypes.map((entry) => (
              <LevelBandWinRateChart
                key={entry.archetype}
                archetype={entry.archetype}
                levels={entry.levels}
                title={t("settings.simulation.winRateChartTitle", {
                  archetype: t(`settings.simulation.archetypes.${entry.archetype}`)
                })}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section style={{ marginTop: "20px", display: "grid", gap: "16px" }}>
        <div>
          <h3 style={{ margin: "0 0 6px" }}>{t("settings.simulation.staticSectionTitle")}</h3>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "14px" }}>{t("settings.simulation.staticSectionDescription")}</p>
        </div>
        {staticCurvesError ? <p style={{ margin: 0, color: "#b85a4e" }}>{staticCurvesError}</p> : null}
        {staticCurves ? (
          <div className="developerSimulationChartsGrid">
            <StaticMetricChart
              title={t("settings.simulation.staticTravelChartTitle")}
              description={t("settings.simulation.staticTravelAxis")}
              data={staticTravelRows}
              kind="duration"
              lineColor="#5f87a3"
              testId="developer-static-travel-chart"
            />
            <StaticMetricChart
              title={t("settings.simulation.staticReplenishChartTitle")}
              description={t("settings.simulation.staticReplenishAxis")}
              data={staticReplenishRows}
              kind="duration"
              lineColor="#7aa37a"
              testId="developer-static-replenish-chart"
            />
            <StaticMetricChart
              title={t("settings.simulation.staticStaminaWaitChartTitle")}
              description={t("settings.simulation.staticStaminaWaitAxis")}
              data={staticStaminaWaitRows}
              kind="duration"
              lineColor="#8f78b8"
              testId="developer-static-stamina-wait-chart"
            />
            <StaticMetricChart
              title={t("settings.simulation.staticContractWaitChartTitle")}
              description={t("settings.simulation.staticContractWaitAxis")}
              data={staticContractWaitRows}
              kind="duration"
              lineColor="#4da3a6"
              testId="developer-static-contract-wait-chart"
            />
            <StaticLevelBandChart
              title={t("settings.simulation.staticXpPerContractChartTitle")}
              description={t("settings.simulation.staticXpPerContractAxis")}
              data={staticCurves.levels}
              testId="developer-static-xp-contract-chart"
            />
            <StaticMetricChart
              title={t("settings.simulation.staticXpRequiredChartTitle")}
              description={t("settings.simulation.staticXpRequiredAxis")}
              data={staticXpRequiredRows}
              kind="number"
              lineColor="#b85a4e"
              testId="developer-static-xp-required-chart"
            />
          </div>
        ) : null}
      </section>
    </article>
  );
}
