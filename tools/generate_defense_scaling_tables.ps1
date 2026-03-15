param(
    [string]$DataDir = ""
)

$ErrorActionPreference = "Stop"

$heavyTargetPct = 0.35
$lightTargetPct = 0.24
$robeTargetPct = 0.14
$jewelryTargetPct = 0.25

if ([string]::IsNullOrWhiteSpace($DataDir)) {
    $repoRoot = Split-Path -Parent $PSScriptRoot
    $DataDir = Join-Path $repoRoot "docs\data"
}

function Get-CsvPath {
    param([string]$FileName)
    return Join-Path $DataDir $FileName
}

function Get-WeaponRows {
    param([string]$FileName)

    Import-Csv -Path (Get-CsvPath $FileName) | ForEach-Object {
        [pscustomobject]@{
            ilvl = [int]$_.ilvl
            rarity = [string]$_.rarity
            average_attack_roll = (([double]$_.possible_attack_roll_low + [double]$_.possible_attack_roll_high) / 2.0)
        }
    }
}

function Split-WeightedWholeNumbers {
    param(
        [int]$Total,
        [hashtable]$Weights
    )

    $keys = $Weights.Keys
    $raw = @{}
    $floors = @{}
    $remainders = @()

    foreach ($key in $keys) {
        $value = $Total * ([double]$Weights[$key] / 100.0)
        $floor = [Math]::Floor($value)
        $raw[$key] = $value
        $floors[$key] = [int]$floor
        $remainders += [pscustomobject]@{
            Key = $key
            Remainder = $value - $floor
            Weight = [int]$Weights[$key]
        }
    }

    $allocated = ($floors.Values | Measure-Object -Sum).Sum
    $remaining = $Total - $allocated

    foreach ($entry in ($remainders | Sort-Object `
        @{ Expression = "Remainder"; Descending = $true }, `
        @{ Expression = "Weight"; Descending = $true }, `
        @{ Expression = "Key"; Descending = $false })) {
        if ($remaining -le 0) {
            break
        }
        $floors[$entry.Key] += 1
        $remaining -= 1
    }

    return $floors
}

function Build-ArmorDefenseRows {
    param(
        [System.Collections.IEnumerable]$WeaponRows,
        [double]$TargetPct
    )

    $weights = @{
        helmet = 15
        upperArmor = 20
        pauldrons = 15
        gloves = 10
        belt = 10
        lowerArmor = 20
        boots = 10
    }

    foreach ($row in $WeaponRows) {
        $targetTotal = [int][Math]::Round($row.average_attack_roll * $TargetPct, [System.MidpointRounding]::AwayFromZero)
        $split = Split-WeightedWholeNumbers -Total $targetTotal -Weights $weights

        [pscustomobject]@{
            ilvl = $row.ilvl
            rarity = $row.rarity
            average_attack_roll = [Math]::Round($row.average_attack_roll, 2)
            defense_target_total = $targetTotal
            helmet = $split.helmet
            upperArmor = $split.upperArmor
            pauldrons = $split.pauldrons
            gloves = $split.gloves
            belt = $split.belt
            lowerArmor = $split.lowerArmor
            boots = $split.boots
        }
    }
}

function Build-JewelryDefenseRows {
    param(
        [System.Collections.IEnumerable]$WeaponRows,
        [double]$TargetPct
    )

    $weights = @{
        necklace = 50
        ring = 50
    }

    foreach ($row in $WeaponRows) {
        $targetTotal = [int][Math]::Round($row.average_attack_roll * $TargetPct, [System.MidpointRounding]::AwayFromZero)
        $split = Split-WeightedWholeNumbers -Total $targetTotal -Weights $weights

        [pscustomobject]@{
            ilvl = $row.ilvl
            rarity = $row.rarity
            average_attack_roll = [Math]::Round($row.average_attack_roll, 2)
            defense_target_total = $targetTotal
            necklace = $split.necklace
            ring = $split.ring
        }
    }
}

$heavyRows = Get-WeaponRows -FileName "warrior_melee_weapon_ilvl_scaling_v2.csv"
$lightRows = Get-WeaponRows -FileName "ranger_ranged_weapon_ilvl_scaling_v1.csv"
$robeRows = Get-WeaponRows -FileName "mage_arcane_weapon_ilvl_scaling_v1.csv"
$jewelryRows = $robeRows

Build-ArmorDefenseRows -WeaponRows $heavyRows -TargetPct $heavyTargetPct |
    Export-Csv -Path (Get-CsvPath "heavy_armor_physical_defense_ilvl_scaling_v1.csv") -NoTypeInformation

Build-ArmorDefenseRows -WeaponRows $lightRows -TargetPct $lightTargetPct |
    Export-Csv -Path (Get-CsvPath "light_armor_physical_defense_ilvl_scaling_v1.csv") -NoTypeInformation

Build-ArmorDefenseRows -WeaponRows $robeRows -TargetPct $robeTargetPct |
    Export-Csv -Path (Get-CsvPath "robe_armor_physical_defense_ilvl_scaling_v1.csv") -NoTypeInformation

Build-JewelryDefenseRows -WeaponRows $jewelryRows -TargetPct $jewelryTargetPct |
    Export-Csv -Path (Get-CsvPath "jewelry_magic_defense_ilvl_scaling_v1.csv") -NoTypeInformation

Write-Output "Wrote defense scaling tables to $DataDir"
