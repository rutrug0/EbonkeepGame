param(
    [string]$ConfigPath = "docs/data/experience_curve_coefficients.csv",
    [string]$OutputPath = "docs/data/experience_requirements_level_1_100.csv"
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

function Geometric-Sum {
    param(
        [double]$A,
        [double]$R,
        [int]$N
    )
    if ($N -le 0) {
        return 0.0
    }
    if ([Math]::Abs($R - 1.0) -lt 1e-12) {
        return $A * $N
    }
    return $A * (([Math]::Pow($R, $N) - 1.0) / ($R - 1.0))
}

if (-not (Test-Path $ConfigPath)) {
    throw "Experience config not found: $ConfigPath"
}

$cfg = Import-Csv -Path $ConfigPath | Select-Object -First 1

$startLevel = [int]$cfg.start_level
$maxLevel = [int]$cfg.max_level
$levelsToGain = $maxLevel - $startLevel
if ($levelsToGain -lt 1) {
    throw "max_level must be greater than start_level."
}

$firstLevelupQuests = [double]$cfg.quests_for_first_levelup
$avgQuestMinutes = [double]$cfg.avg_quest_minutes
$dailyPlayHours = [double]$cfg.daily_playtime_hours
$targetDays = [double]$cfg.target_days_to_cap
$xpPerQuest = [double]$cfg.xp_per_quest

$questsPerDayCap = ($dailyPlayHours * 60.0) / $avgQuestMinutes
$targetTotalQuests = $questsPerDayCap * $targetDays

$ratio = 1.0
$flatTotal = Geometric-Sum -A $firstLevelupQuests -R 1.0 -N $levelsToGain
if ($flatTotal -lt $targetTotalQuests) {
    $low = 1.0
    $high = 1.05
    while ((Geometric-Sum -A $firstLevelupQuests -R $high -N $levelsToGain) -lt $targetTotalQuests) {
        $high = $high + 0.02
        if ($high -gt 2.0) {
            throw "Could not bracket geometric ratio within expected bounds."
        }
    }

    for ($i = 0; $i -lt 120; $i++) {
        $mid = ($low + $high) / 2.0
        $sum = Geometric-Sum -A $firstLevelupQuests -R $mid -N $levelsToGain
        if ($sum -lt $targetTotalQuests) {
            $low = $mid
        }
        else {
            $high = $mid
        }
    }
    $ratio = ($low + $high) / 2.0
}

$rows = New-Object System.Collections.Generic.List[object]
$cumulativeQuests = 0.0
$cumulativeXp = 0.0

for ($level = $startLevel; $level -le $maxLevel; $level++) {
    $questsToNext = 0.0
    if ($level -lt $maxLevel) {
        $exponent = $level - $startLevel
        $questsToNext = $firstLevelupQuests * [Math]::Pow($ratio, $exponent)
    }

    $minutesToNext = $questsToNext * $avgQuestMinutes
    $hoursToNext = $minutesToNext / 60.0
    $daysToNextAtCap = if ($dailyPlayHours -gt 0) { $hoursToNext / $dailyPlayHours } else { 0.0 }
    $xpToNext = Round-AwayFromZero ($questsToNext * $xpPerQuest)

    $rows.Add([PSCustomObject]@{
            level = $level
            quests_to_next = Round-2 $questsToNext
            minutes_to_next = Round-2 $minutesToNext
            hours_to_next = Round-2 $hoursToNext
            days_to_next_at_cap = Round-2 $daysToNextAtCap
            xp_per_quest = Round-2 $xpPerQuest
            xp_to_next = $xpToNext
            cumulative_quests_to_reach_level = Round-2 $cumulativeQuests
            cumulative_xp_to_reach_level = Round-AwayFromZero $cumulativeXp
            curve_ratio_per_level = [Math]::Round($ratio, 8)
            quests_per_day_cap = Round-2 $questsPerDayCap
            target_total_quests = Round-2 $targetTotalQuests
        })

    $cumulativeQuests += $questsToNext
    $cumulativeXp += ($questsToNext * $xpPerQuest)
}

$outDir = Split-Path -Parent $OutputPath
if (-not [string]::IsNullOrWhiteSpace($outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$rows | Export-Csv -Path $OutputPath -NoTypeInformation
Write-Output "Wrote $($rows.Count) rows to $OutputPath"
