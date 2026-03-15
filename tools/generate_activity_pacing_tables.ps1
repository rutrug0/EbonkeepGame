param(
    [string]$ConfigPath = "docs/data/activity_pacing_coefficients.csv",
    [string]$ActivityOutputPath = "docs/data/activity_pacing_level_1_100.csv",
    [string]$ReplenishOutputPath = "docs/data/contract_replenish_pacing_level_1_100.csv"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Round-AwayFromZero {
    param([double]$Value)
    return [long][Math]::Round($Value, 0, [MidpointRounding]::AwayFromZero)
}

function Round-ToDecimalsAwayFromZero {
    param(
        [double]$Value,
        [int]$Decimals
    )

    return [Math]::Round($Value, $Decimals, [MidpointRounding]::AwayFromZero)
}

function Get-SeriesValue {
    param(
        [System.Collections.Generic.Dictionary[string, object[]]]$AnchorsBySeries,
        [string]$Series,
        [int]$Level,
        [int]$Decimals = 0
    )

    $anchors = $AnchorsBySeries[$Series]
    if (-not $anchors -or $anchors.Count -eq 0) {
        throw "Missing anchor data for series '$Series'"
    }

    foreach ($anchor in $anchors) {
        if ([int]$anchor.level -eq $Level) {
            if ($Decimals -gt 0) {
                return Round-ToDecimalsAwayFromZero -Value ([double]$anchor.value) -Decimals $Decimals
            }
            return Round-AwayFromZero ([double]$anchor.value)
        }
    }

    if ($Level -le [int]$anchors[0].level) {
        if ($Decimals -gt 0) {
            return Round-ToDecimalsAwayFromZero -Value ([double]$anchors[0].value) -Decimals $Decimals
        }
        return Round-AwayFromZero ([double]$anchors[0].value)
    }

    $lastAnchor = $anchors[$anchors.Count - 1]
    if ($Level -ge [int]$lastAnchor.level) {
        if ($Decimals -gt 0) {
            return Round-ToDecimalsAwayFromZero -Value ([double]$lastAnchor.value) -Decimals $Decimals
        }
        return Round-AwayFromZero ([double]$lastAnchor.value)
    }

    for ($index = 0; $index -lt $anchors.Count - 1; $index++) {
        $left = $anchors[$index]
        $right = $anchors[$index + 1]
        $leftLevel = [int]$left.level
        $rightLevel = [int]$right.level

        if ($Level -lt $leftLevel -or $Level -gt $rightLevel) {
            continue
        }

        $span = [double]($rightLevel - $leftLevel)
        if ($span -le 0) {
            if ($Decimals -gt 0) {
                return Round-ToDecimalsAwayFromZero -Value ([double]$left.value) -Decimals $Decimals
            }
            return Round-AwayFromZero ([double]$left.value)
        }

        $progress = ([double]($Level - $leftLevel)) / $span
        $value = ([double]$left.value) + ((([double]$right.value) - ([double]$left.value)) * $progress)
        if ($Decimals -gt 0) {
            return Round-ToDecimalsAwayFromZero -Value $value -Decimals $Decimals
        }
        return Round-AwayFromZero $value
    }

    throw "Unable to interpolate series '$Series' at level $Level"
}

if (-not (Test-Path $ConfigPath)) {
    throw "Config not found: $ConfigPath"
}

$anchorsBySeries = New-Object 'System.Collections.Generic.Dictionary[string, object[]]'
foreach ($row in (Import-Csv -Path $ConfigPath)) {
    $series = [string]$row.series
    if (-not $anchorsBySeries.ContainsKey($series)) {
        $anchorsBySeries[$series] = @()
    }

    $anchorsBySeries[$series] += [PSCustomObject]@{
        level = [int]$row.level
        value = [double]$row.value
    }
}

foreach ($series in @($anchorsBySeries.Keys)) {
    $anchorsBySeries[$series] = @($anchorsBySeries[$series] | Sort-Object level)
}

$activityRows = New-Object System.Collections.Generic.List[object]
$replenishRows = New-Object System.Collections.Generic.List[object]

for ($level = 1; $level -le 100; $level++) {
    $travelSecondsBase = Get-SeriesValue -AnchorsBySeries $anchorsBySeries -Series "travel_seconds_base" -Level $level
    $staminaRegenPercentPerHour = Get-SeriesValue -AnchorsBySeries $anchorsBySeries -Series "stamina_regen_percent_per_hour" -Level $level -Decimals 1
    $contractStaminaCostLow = Get-SeriesValue -AnchorsBySeries $anchorsBySeries -Series "contract_stamina_cost_low" -Level $level
    $contractStaminaCostStandard = Get-SeriesValue -AnchorsBySeries $anchorsBySeries -Series "contract_stamina_cost_standard" -Level $level
    $contractStaminaCostHigh = Get-SeriesValue -AnchorsBySeries $anchorsBySeries -Series "contract_stamina_cost_high" -Level $level
    $replenishMinSeconds = Get-SeriesValue -AnchorsBySeries $anchorsBySeries -Series "contract_replenish_min_seconds" -Level $level
    $replenishMaxSeconds = Get-SeriesValue -AnchorsBySeries $anchorsBySeries -Series "contract_replenish_max_seconds" -Level $level

    $activityRows.Add([PSCustomObject]@{
            level = $level
            travel_seconds_base = $travelSecondsBase
            stamina_regen_percent_per_hour = $staminaRegenPercentPerHour
            contract_stamina_cost_low = $contractStaminaCostLow
            contract_stamina_cost_standard = $contractStaminaCostStandard
            contract_stamina_cost_high = $contractStaminaCostHigh
            mission_stamina_cost_low = $contractStaminaCostLow
            mission_stamina_cost_standard = $contractStaminaCostStandard
            mission_stamina_cost_high = $contractStaminaCostHigh
        })

    $replenishRows.Add([PSCustomObject]@{
            level = $level
            replenish_min_seconds = $replenishMinSeconds
            replenish_max_seconds = $replenishMaxSeconds
        })
}

$outputDirs = @(
    (Split-Path -Parent $ActivityOutputPath),
    (Split-Path -Parent $ReplenishOutputPath)
) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique

foreach ($dir in $outputDirs) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}

$activityRows | Export-Csv -Path $ActivityOutputPath -NoTypeInformation
$replenishRows | Export-Csv -Path $ReplenishOutputPath -NoTypeInformation

Write-Output "Wrote $($activityRows.Count) rows to $ActivityOutputPath"
Write-Output "Wrote $($replenishRows.Count) rows to $ReplenishOutputPath"
