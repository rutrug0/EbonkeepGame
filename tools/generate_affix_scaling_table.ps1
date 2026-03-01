param(
    [string]$ConfigPath = "docs/data/affix_scaling_coefficients.csv",
    [string]$OutputPath = "docs/data/affix_scaling_level_1_100.csv"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path $ConfigPath)) {
    throw "Scaling config file not found: $ConfigPath"
}

$definitions = Import-Csv -Path $ConfigPath

function Round-AwayFromZero {
    param(
        [double]$Value
    )
    return [int][Math]::Round($Value, 0, [MidpointRounding]::AwayFromZero)
}

$rows = New-Object System.Collections.Generic.List[object]

for ($level = 1; $level -le 100; $level++) {
    foreach ($definition in $definitions) {
            $levelOffset = 0.0
            if ($null -ne $definition.level_offset -and -not [string]::IsNullOrWhiteSpace([string]$definition.level_offset)) {
                $levelOffset = [double]$definition.level_offset
            }

            $growthMultiplier = 1.0
            if ($null -ne $definition.growth_multiplier -and -not [string]::IsNullOrWhiteSpace([string]$definition.growth_multiplier)) {
                $growthMultiplier = [double]$definition.growth_multiplier
            }

            # Base linear model with configurable offset and slope multiplier.
            $linearEffectiveLevel = (1.0 + $levelOffset) + (($level - 1.0) * $growthMultiplier)

            # Optional geometric amplification (default disabled via 1.0).
            $geometricGrowthPerLevel = 1.0
            if ($null -ne $definition.geometric_growth_per_level -and -not [string]::IsNullOrWhiteSpace([string]$definition.geometric_growth_per_level)) {
                $geometricGrowthPerLevel = [double]$definition.geometric_growth_per_level
            }
            $geometricMultiplier = [Math]::Pow($geometricGrowthPerLevel, ($level - 1.0))
            $effectiveLevel = $linearEffectiveLevel * $geometricMultiplier

            $min = Round-AwayFromZero ($effectiveLevel * [double]$definition.min_coef)
            $max = Round-AwayFromZero ($effectiveLevel * [double]$definition.max_coef)

            if ($definition.unit -eq "flat") {
                if ($min -lt 1) { $min = 1 }
                if ($max -lt 1) { $max = 1 }
            }

            if ($max -lt $min) {
                $max = $min
            }

            $rows.Add([PSCustomObject]@{
                    level = $level
                    effective_level = [Math]::Round($effectiveLevel, 2)
                    linear_effective_level = [Math]::Round($linearEffectiveLevel, 2)
                    geometric_multiplier = [Math]::Round($geometricMultiplier, 6)
                    scale_key = $definition.scale_key
                    aliases = $definition.aliases
                    tier = $definition.tier
                    roll_min = $min
                    roll_max = $max
                    unit = $definition.unit
                })
    }
}

$outDir = Split-Path -Parent $OutputPath
if (-not [string]::IsNullOrWhiteSpace($outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$rows | Export-Csv -Path $OutputPath -NoTypeInformation
Write-Output "Wrote $($rows.Count) rows to $OutputPath"
