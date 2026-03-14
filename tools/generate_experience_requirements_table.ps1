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

function Get-InterpolatedQuestRequirement {
    param(
        [int]$Level,
        [object[]]$Anchors
    )

    if ($Anchors.Count -lt 2) {
        throw "At least two anchor rows are required."
    }

    for ($index = 0; $index -lt $Anchors.Count - 1; $index += 1) {
        $start = $Anchors[$index]
        $end = $Anchors[$index + 1]
        if ($Level -lt $start.level -or $Level -ge $end.level) {
            continue
        }

        $span = $end.level - $start.level
        if ($span -le 0) {
            throw "Anchor levels must be strictly increasing."
        }

        if ($start.quests_to_next -le 0.0 -or $end.quests_to_next -le 0.0) {
            throw "Anchor quest requirements must be positive."
        }

        $position = ($Level - $start.level) / $span
        $startLog = [Math]::Log($start.quests_to_next)
        $endLog = [Math]::Log($end.quests_to_next)
        return [Math]::Exp($startLog + (($endLog - $startLog) * $position))
    }

    if ($Level -eq $Anchors[$Anchors.Count - 1].level) {
        return $Anchors[$Anchors.Count - 1].quests_to_next
    }

    throw "No anchor span found for level $Level."
}

if (-not (Test-Path $ConfigPath)) {
    throw "Experience config not found: $ConfigPath"
}

$cfgRows = Import-Csv -Path $ConfigPath
if ($cfgRows.Count -lt 2) {
    throw "Experience config requires at least two anchor rows."
}

$settings = $cfgRows | Select-Object -First 1
$maxLevel = [int]$settings.max_level
$startLevel = [int](($cfgRows | Sort-Object { [int]$_.level } | Select-Object -First 1).level)
$levelsToGain = $maxLevel - $startLevel
if ($levelsToGain -lt 1) {
    throw "max_level must be greater than start_level."
}

$avgQuestMinutes = [double]$settings.avg_quest_minutes
$dailyPlayHours = [double]$settings.daily_playtime_hours
$xpPerQuest = [double]$settings.xp_per_quest
$anchors = $cfgRows |
    Sort-Object { [int]$_.level } |
    ForEach-Object {
        [PSCustomObject]@{
            level = [int]$_.level
            quests_to_next = [double]$_.quests_to_next
        }
    }

if ($anchors[0].level -ne $startLevel) {
    throw "Experience anchors must include the start level."
}

if ($anchors[$anchors.Count - 1].level -ne $maxLevel) {
    throw "Experience anchors must include the max level."
}

for ($index = 1; $index -lt $anchors.Count; $index += 1) {
    if ($anchors[$index].level -le $anchors[$index - 1].level) {
        throw "Experience anchor levels must be strictly increasing."
    }
    if ($anchors[$index].quests_to_next -lt $anchors[$index - 1].quests_to_next) {
        throw "Experience anchor quests_to_next must be monotonic non-decreasing."
    }
}

$questsPerDayCap = ($dailyPlayHours * 60.0) / $avgQuestMinutes

$rows = New-Object System.Collections.Generic.List[object]
$cumulativeQuests = 0.0
$cumulativeXp = 0.0
$totalQuests = 0.0
$questsByLevel = @{}
$previousQuestsToNext = 0.0

for ($level = $startLevel; $level -lt $maxLevel; $level++) {
    $questsToNext = Get-InterpolatedQuestRequirement -Level $level -Anchors $anchors
    $questsByLevel[$level] = $questsToNext
    $totalQuests += $questsToNext
}

for ($level = $startLevel; $level -le $maxLevel; $level++) {
    $questsToNext = 0.0
    if ($level -lt $maxLevel) {
        $questsToNext = $questsByLevel[$level]
    }

    $minutesToNext = $questsToNext * $avgQuestMinutes
    $hoursToNext = $minutesToNext / 60.0
    $daysToNextAtCap = if ($dailyPlayHours -gt 0) { $hoursToNext / $dailyPlayHours } else { 0.0 }
    $xpToNext = Round-AwayFromZero ($questsToNext * $xpPerQuest)
    $effectiveRatio = if ($level -eq $startLevel) {
        if ($startLevel -lt $maxLevel) {
            $nextQuests = $questsByLevel[$startLevel + 1]
            $nextQuests / $questsToNext
        }
        else {
            0.0
        }
    }
    elseif ($previousQuestsToNext -gt 0.0) {
        $questsToNext / $previousQuestsToNext
    }
    else {
        0.0
    }

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
            curve_ratio_per_level = [Math]::Round($effectiveRatio, 8)
            quests_per_day_cap = Round-2 $questsPerDayCap
            target_total_quests = Round-2 $totalQuests
        })

    $cumulativeQuests += $questsToNext
    $cumulativeXp += ($questsToNext * $xpPerQuest)
    $previousQuestsToNext = $questsToNext
}

$outDir = Split-Path -Parent $OutputPath
if (-not [string]::IsNullOrWhiteSpace($outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$rows | Export-Csv -Path $OutputPath -NoTypeInformation
Write-Output "Wrote $($rows.Count) rows to $OutputPath"
