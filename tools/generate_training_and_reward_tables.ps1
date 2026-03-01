param(
    [string]$TrainingConfigPath = "docs/data/passive_training_coefficients.csv",
    [string]$MissionConfigPath = "docs/data/mission_ducat_coefficients.csv",
    [string]$TrainingOutputPath = "docs/data/passive_training_scaling_level_1_100.csv",
    [string]$MissionOutputPath = "docs/data/mission_ducat_rewards_level_1_100.csv"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Round-AwayFromZero {
    param([double]$Value)
    return [long][Math]::Round($Value, 0, [MidpointRounding]::AwayFromZero)
}

function Round-2 {
    param([double]$Value)
    return [Math]::Round($Value, 2, [MidpointRounding]::AwayFromZero)
}

function Expected-Total-Stat {
    param(
        [pscustomobject]$TrainingConfigRow,
        [int]$Level
    )

    $base = [double]$TrainingConfigRow.expected_total_base
    $perLevel = [double]$TrainingConfigRow.expected_total_per_level
    $linear = $base + ($perLevel * $Level)

    $growthPerLevel = 1.0
    $props = $TrainingConfigRow.PSObject.Properties.Name
    if ($props -contains "expected_total_growth_per_level") {
        $growthPerLevel = [double]$TrainingConfigRow.expected_total_growth_per_level
    }

    return $linear * [Math]::Pow($growthPerLevel, ($Level - 1.0))
}

function Level-Multiplier {
    param(
        [double]$GrowthPer10Levels,
        [int]$Level
    )
    return [Math]::Pow($GrowthPer10Levels, (($Level - 1.0) / 10.0))
}

function Training-Level-Multiplier {
    param(
        [pscustomobject]$TrainingConfigRow,
        [int]$Level
    )

    $props = $TrainingConfigRow.PSObject.Properties.Name
    if ($props -contains "cost_level_growth_per_level") {
        $growthPerLevel = [double]$TrainingConfigRow.cost_level_growth_per_level
        return [Math]::Pow($growthPerLevel, ($Level - 1.0))
    }

    # Backward-compatible fallback for older configs.
    $growthPer10 = [double]$TrainingConfigRow.cost_level_growth_per_10_levels
    return [Math]::Pow($growthPer10, (($Level - 1.0) / 10.0))
}

function Mission-Level-Multiplier {
    param(
        [pscustomobject]$MissionConfig,
        [int]$Level
    )

    $props = $MissionConfig.PSObject.Properties.Name
    if ($props -contains "level_growth_per_level") {
        $growthPerLevel = [double]$MissionConfig.level_growth_per_level
        return [Math]::Pow($growthPerLevel, ($Level - 1.0))
    }

    # Backward-compatible fallback for older configs.
    $growthPer10 = [double]$MissionConfig.level_growth_per_10_levels
    return [Math]::Pow($growthPer10, (($Level - 1.0) / 10.0))
}

if (-not (Test-Path $TrainingConfigPath)) {
    throw "Training config not found: $TrainingConfigPath"
}
if (-not (Test-Path $MissionConfigPath)) {
    throw "Mission config not found: $MissionConfigPath"
}

$trainingConfig = Import-Csv -Path $TrainingConfigPath
$missionConfig = Import-Csv -Path $MissionConfigPath | Select-Object -First 1

$baseReward = [double]$missionConfig.base_reward_ducats
$rewardVariance = [double]$missionConfig.reward_variance_pct
$eliteMultiplier = [double]$missionConfig.elite_multiplier
$bossMultiplier = [double]$missionConfig.boss_multiplier

$missionRows = New-Object System.Collections.Generic.List[object]
$trainingRows = New-Object System.Collections.Generic.List[object]

for ($level = 1; $level -le 100; $level++) {
    $missionLevelMultiplier = Mission-Level-Multiplier -MissionConfig $missionConfig -Level $level
    $missionBaseReward = Round-AwayFromZero ($baseReward * $missionLevelMultiplier)
    $missionMinReward = Round-AwayFromZero ($missionBaseReward * (1.0 - $rewardVariance))
    $missionMaxReward = Round-AwayFromZero ($missionBaseReward * (1.0 + $rewardVariance))
    $missionEliteReward = Round-AwayFromZero ($missionBaseReward * $eliteMultiplier)
    $missionBossReward = Round-AwayFromZero ($missionBaseReward * $bossMultiplier)

    $missionRows.Add([PSCustomObject]@{
            level = $level
            level_multiplier = [Math]::Round($missionLevelMultiplier, 6)
            base_reward_ducats = $missionBaseReward
            reward_min_ducats = $missionMinReward
            reward_max_ducats = $missionMaxReward
            elite_reward_ducats = $missionEliteReward
            boss_reward_ducats = $missionBossReward
        })

    foreach ($cfg in $trainingConfig) {
        $expectedTotal = Round-2 (Expected-Total-Stat -TrainingConfigRow $cfg -Level $level)
        $targetShare = [double]$cfg.target_share
        $targetTrainingStat = Round-2 ($expectedTotal * $targetShare)
        if ($targetTrainingStat -le 0) {
            $targetTrainingStat = 0.01
        }

        $gainPerClick = [double]$cfg.gain_per_click
        if ($gainPerClick -le 0) {
            throw "gain_per_click must be > 0 for stat_group=$($cfg.stat_group)"
        }

        $targetTrainingClicks = [int][Math]::Ceiling($targetTrainingStat / $gainPerClick)
        if ($targetTrainingClicks -lt 1) {
            $targetTrainingClicks = 1
        }
        $effectiveTrainingStatAtTarget = Round-2 ($targetTrainingClicks * $gainPerClick)

        $maxClickCap = [int]$cfg.max_click_cap
        if ($maxClickCap -lt 1) {
            $maxClickCap = 1
        }
        $maxTrainableStatAtCap = Round-2 ($maxClickCap * $gainPerClick)
        $trainShareAtCap = Round-2 ($maxTrainableStatAtCap / [Math]::Max(0.01, $expectedTotal))

        $costLevelMultiplier = Training-Level-Multiplier -TrainingConfigRow $cfg -Level $level
        $baseClickCost = Round-AwayFromZero (([double]$cfg.base_click_cost_ducats) * $costLevelMultiplier)
        $costGrowthPerClick = [double]$cfg.cost_growth_per_click
        $purchaseExponent = [Math]::Max(0, $targetTrainingClicks - 1)
        $nextClickCostAtTarget = Round-AwayFromZero (([double]$cfg.base_click_cost_ducats) * $costLevelMultiplier * [Math]::Pow($costGrowthPerClick, $purchaseExponent))

        $totalCost = 0.0
        if ($costGrowthPerClick -eq 1.0) {
            $totalCost = ([double]$cfg.base_click_cost_ducats) * $costLevelMultiplier * $targetTrainingClicks
        }
        else {
            $totalCost = (([double]$cfg.base_click_cost_ducats) * $costLevelMultiplier) * (([Math]::Pow($costGrowthPerClick, $targetTrainingClicks) - 1.0) / ($costGrowthPerClick - 1.0))
        }

        $missionsForNextPoint = [Math]::Round(($nextClickCostAtTarget / [Math]::Max(1, $missionBaseReward)), 2)
        $missionsForTarget = [Math]::Round(($totalCost / [Math]::Max(1, $missionBaseReward)), 2)

        $trainingRows.Add([PSCustomObject]@{
                level = $level
                stat_group = $cfg.stat_group
                aliases = $cfg.aliases
                unit = $cfg.unit
                expected_total_stat = $expectedTotal
                target_training_share = $targetShare
                target_training_stat = $targetTrainingStat
                gain_per_click = $gainPerClick
                target_training_clicks = $targetTrainingClicks
                effective_training_stat_at_target = $effectiveTrainingStatAtTarget
                max_click_cap = $maxClickCap
                max_trainable_stat_at_cap = $maxTrainableStatAtCap
                train_share_at_cap = $trainShareAtCap
                cost_level_multiplier = [Math]::Round($costLevelMultiplier, 6)
                base_click_cost_ducats = $baseClickCost
                next_click_cost_at_target_ducats = $nextClickCostAtTarget
                total_cost_to_target_ducats = Round-AwayFromZero $totalCost
                missions_for_next_click_at_target = $missionsForNextPoint
                missions_for_target_from_zero = $missionsForTarget
                mission_base_reward_ducats = $missionBaseReward
            })
    }
}

$outDirs = @(
    (Split-Path -Parent $TrainingOutputPath),
    (Split-Path -Parent $MissionOutputPath)
) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique

foreach ($dir in $outDirs) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}

$trainingRows | Export-Csv -Path $TrainingOutputPath -NoTypeInformation
$missionRows | Export-Csv -Path $MissionOutputPath -NoTypeInformation

Write-Output "Wrote $($trainingRows.Count) rows to $TrainingOutputPath"
Write-Output "Wrote $($missionRows.Count) rows to $MissionOutputPath"
