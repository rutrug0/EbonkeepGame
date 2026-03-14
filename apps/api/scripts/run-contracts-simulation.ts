import { runDeveloperContractSimulationToArtifact } from "../src/modules/contracts/developer-simulation.js";
import type { PlayerClass } from "@ebonkeep/shared/core";

type CliOptions = {
  playerClass: string;
  sampleSize: number;
  maxLevel?: number;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    playerClass: "juggernaut",
    sampleSize: 100
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];

    if (argument === "--playerClass" && value) {
      options.playerClass = value;
      index += 1;
      continue;
    }

    if (argument === "--sampleSize" && value) {
      options.sampleSize = Number.parseInt(value, 10);
      index += 1;
      continue;
    }

    if (argument === "--maxLevel" && value) {
      options.maxLevel = Number.parseInt(value, 10);
      index += 1;
    }
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));
const { artifactPath, config, jobId, result } = await runDeveloperContractSimulationToArtifact({
  playerClass: options.playerClass as PlayerClass,
  sampleSize: options.sampleSize,
  maxLevel: options.maxLevel
});

const averageArchetype = result.archetypes.find((archetype) => archetype.archetype === "average");
console.log(JSON.stringify({
  artifactPath,
  benchmarkTargetBandHitRateByDifficulty: averageArchetype?.benchmarkTargetBandHitRateByDifficulty ?? null,
  config,
  jobId
}, null, 2));
