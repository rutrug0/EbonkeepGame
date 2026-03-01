param(
    [string]$DamageConfigPath = "docs/data/warrior_weapon_damage_coefficients_v2.csv",
    [string]$DamageOutputPath = "docs/data/warrior_melee_weapon_ilvl_scaling_v2.csv",
    [string]$NameOutputPath = "docs/data/warrior_melee_weapon_name_ranges_v2.csv",
    [int]$LevelCap = 100
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

if (-not (Test-Path $DamageConfigPath)) {
    throw "Damage config not found: $DamageConfigPath"
}

$cfg = Import-Csv -Path $DamageConfigPath | Select-Object -First 1

$startIlvl = [int]$cfg.start_ilvl
$endIlvl = [int]$cfg.end_ilvl
$baseAvgCommon = [double]$cfg.base_avg_common
$avgGrowthPerIlvl = [double]$cfg.avg_growth_per_ilvl
$spreadPct = [double]$cfg.strength_template_spread_pct
$creationVariancePct = [double]$cfg.creation_variance_pct

$rarities = @(
    @{ name = "common"; mult = [double]$cfg.rarity_common },
    @{ name = "uncommon"; mult = [double]$cfg.rarity_uncommon },
    @{ name = "rare"; mult = [double]$cfg.rarity_rare },
    @{ name = "epic"; mult = [double]$cfg.rarity_epic }
)

$damageRows = New-Object System.Collections.Generic.List[object]
for ($ilvl = $startIlvl; $ilvl -le $endIlvl; $ilvl++) {
    $commonAvg = $baseAvgCommon + ($avgGrowthPerIlvl * $ilvl)
    foreach ($rarity in $rarities) {
        $rarityMult = [double]$rarity.mult
        $templateAvg = $commonAvg * $rarityMult
        $templateMin = $templateAvg * (1.0 - $spreadPct)
        $templateMax = $templateAvg * (1.0 + $spreadPct)

        $creationMinLow = Round-AwayFromZero ($templateMin * (1.0 - $creationVariancePct))
        $creationMinHigh = Round-AwayFromZero ($templateMin * (1.0 + $creationVariancePct))
        $creationMaxLow = Round-AwayFromZero ($templateMax * (1.0 - $creationVariancePct))
        $creationMaxHigh = Round-AwayFromZero ($templateMax * (1.0 + $creationVariancePct))

        if ($creationMinLow -lt 1) { $creationMinLow = 1 }
        if ($creationMinHigh -lt $creationMinLow) { $creationMinHigh = $creationMinLow }
        if ($creationMaxLow -lt $creationMinHigh) { $creationMaxLow = $creationMinHigh }
        if ($creationMaxHigh -lt $creationMaxLow) { $creationMaxHigh = $creationMaxLow }

        $damageRows.Add([PSCustomObject]@{
                ilvl = $ilvl
                rarity = $rarity.name
                rarity_multiplier = Round-2 $rarityMult
                template_avg_damage = Round-2 $templateAvg
                template_min_damage = Round-2 $templateMin
                template_max_damage = Round-2 $templateMax
                item_roll_min_low = $creationMinLow
                item_roll_min_high = $creationMinHigh
                item_roll_max_low = $creationMaxLow
                item_roll_max_high = $creationMaxHigh
                possible_attack_roll_low = $creationMinLow
                possible_attack_roll_high = $creationMaxHigh
            })
    }
}

$weapons = @(
    @{ name = "Iron Shortsword"; type = "Sword" },
    @{ name = "Brackenhilt"; type = "Sword" },
    @{ name = "Woodcutter's Axe"; type = "Axe" },
    @{ name = "Greyfen Blade"; type = "Sword" },
    @{ name = "Plainsteel Longsword"; type = "Sword" },
    @{ name = "Valdaryn"; type = "Sword" },
    @{ name = "Bearded War Axe"; type = "Axe" },
    @{ name = "Redmark Sabre"; type = "Sword" },
    @{ name = "Tempered Longblade"; type = "Sword" },
    @{ name = "Frosthollow Axe"; type = "Axe" },
    @{ name = "Damascus Steel"; type = "Sword" },
    @{ name = "Valenmark"; type = "Axe" },
    @{ name = "Knight's Arming Sword"; type = "Sword" },
    @{ name = "Durnholde Axe"; type = "Axe" },
    @{ name = "Rivenspire Greatsword"; type = "Sword" },
    @{ name = "Blackmoor Cleaver"; type = "Axe" },
    @{ name = "Gilded Bastard Sword"; type = "Sword" },
    @{ name = "Harthorn"; type = "Axe" },
    @{ name = "Highguard Claymore"; type = "Sword" },
    @{ name = "Stormvale Axe"; type = "Axe" },
    @{ name = "Silvermark Longblade"; type = "Sword" },
    @{ name = "Dornhal Greataxe"; type = "Axe" },
    @{ name = "Crestfall Greatsword"; type = "Sword" },
    @{ name = "Kingsreach Axe"; type = "Axe" },
    @{ name = "Imperial Warblade"; type = "Sword" }
)

$nameRows = New-Object System.Collections.Generic.List[object]
for ($i = 0; $i -lt $weapons.Count; $i++) {
    $idx = $i + 1
    $baseLevel = $i * 4
    $dropMin = [Math]::Max(0, $baseLevel - 10)
    $dropMaxRaw = $baseLevel + 10
    $dropMaxCapped = [Math]::Min($LevelCap, $dropMaxRaw)

    $nameRows.Add([PSCustomObject]@{
            sequence = $idx
            weapon_name = $weapons[$i].name
            weapon_type = $weapons[$i].type
            damage_category = "strength"
            base_level = $baseLevel
            drop_min_level = $dropMin
            drop_max_level_raw = $dropMaxRaw
            drop_max_level_capped = $dropMaxCapped
        })
}

$outDirs = @(
    (Split-Path -Parent $DamageOutputPath),
    (Split-Path -Parent $NameOutputPath)
) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique

foreach ($dir in $outDirs) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}

$damageRows | Export-Csv -Path $DamageOutputPath -NoTypeInformation
$nameRows | Export-Csv -Path $NameOutputPath -NoTypeInformation

Write-Output "Wrote $($damageRows.Count) rows to $DamageOutputPath"
Write-Output "Wrote $($nameRows.Count) rows to $NameOutputPath"
