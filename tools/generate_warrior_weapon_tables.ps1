param(
    [string]$DamageConfigPath = "docs/data/warrior_weapon_damage_coefficients_v2.csv",
    [string]$CategoryProfilesPath = "docs/data/weapon_damage_category_profiles.csv",
    [string]$OutputDir = "docs/data",
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
if (-not (Test-Path $CategoryProfilesPath)) {
    throw "Damage category profiles not found: $CategoryProfilesPath"
}

$cfg = Import-Csv -Path $DamageConfigPath | Select-Object -First 1

$startIlvl = [int]$cfg.start_ilvl
$endIlvl = [int]$cfg.end_ilvl
$baseAvgCommon = [double]$cfg.base_avg_common
$avgGrowthPerIlvl = [double]$cfg.avg_growth_per_ilvl
$creationVariancePct = [double]$cfg.creation_variance_pct

$rarities = @(
    @{ name = "common"; mult = [double]$cfg.rarity_common },
    @{ name = "uncommon"; mult = [double]$cfg.rarity_uncommon },
    @{ name = "rare"; mult = [double]$cfg.rarity_rare },
    @{ name = "epic"; mult = [double]$cfg.rarity_epic }
)

$profileRows = Import-Csv -Path $CategoryProfilesPath
$spreadByCategory = @{}
foreach ($row in $profileRows) {
    $spreadByCategory[$row.damage_category] = [double]$row.template_spread_pct
}

function New-DamageRows {
    param(
        [string]$DamageCategory,
        [double]$SpreadPct,
        [int]$FromIlvl,
        [int]$ToIlvl,
        [double]$BaseAvg,
        [double]$AvgGrowth,
        [double]$CreationVariance,
        [object[]]$RarityDefs
    )

    $rows = New-Object System.Collections.Generic.List[object]
    for ($ilvl = $FromIlvl; $ilvl -le $ToIlvl; $ilvl++) {
        $commonAvg = $BaseAvg + ($AvgGrowth * $ilvl)
        foreach ($rarity in $RarityDefs) {
            $rarityMult = [double]$rarity.mult
            $templateAvg = $commonAvg * $rarityMult
            $templateMin = $templateAvg * (1.0 - $SpreadPct)
            $templateMax = $templateAvg * (1.0 + $SpreadPct)

            $creationMinLow = Round-AwayFromZero ($templateMin * (1.0 - $CreationVariance))
            $creationMinHigh = Round-AwayFromZero ($templateMin * (1.0 + $CreationVariance))
            $creationMaxLow = Round-AwayFromZero ($templateMax * (1.0 - $CreationVariance))
            $creationMaxHigh = Round-AwayFromZero ($templateMax * (1.0 + $CreationVariance))

            if ($creationMinLow -lt 1) { $creationMinLow = 1 }
            if ($creationMinHigh -lt $creationMinLow) { $creationMinHigh = $creationMinLow }
            if ($creationMaxLow -lt $creationMinHigh) { $creationMaxLow = $creationMinHigh }
            if ($creationMaxHigh -lt $creationMaxLow) { $creationMaxHigh = $creationMaxLow }

            $rows.Add([PSCustomObject]@{
                    ilvl = $ilvl
                    rarity = $rarity.name
                    damage_category = $DamageCategory
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
    return $rows
}

function New-NameRows {
    param(
        [string]$WeaponFamily,
        [string]$AllowedClass,
        [string]$DamageCategory,
        [object[]]$Weapons,
        [int]$MaxLevel
    )

    $rows = New-Object System.Collections.Generic.List[object]

    function Resolve-FlavorText {
        param(
            [string]$BaseFlavor
        )

        $flavor = $BaseFlavor.Trim()
        if (-not $flavor.EndsWith(".")) {
            $flavor = "$flavor."
        }

        return $flavor
    }

    for ($i = 0; $i -lt $Weapons.Count; $i++) {
        $idx = $i + 1
        $baseLevel = $i * 4
        $dropMin = [Math]::Max(0, $baseLevel - 10)
        $dropMaxRaw = $baseLevel + 10
        $dropMaxCapped = [Math]::Min($MaxLevel, $dropMaxRaw)

        $rows.Add([PSCustomObject]@{
                sequence = $idx
                weapon_name = $Weapons[$i].name
                weapon_type = $Weapons[$i].type
                weapon_family = $WeaponFamily
                allowed_class = $AllowedClass
                damage_category = $DamageCategory
                flavor_text = Resolve-FlavorText `
                    -BaseFlavor ([string]$Weapons[$i].flavor)
                base_level = $baseLevel
                drop_min_level = $dropMin
                drop_max_level_raw = $dropMaxRaw
                drop_max_level_capped = $dropMaxCapped
            })
    }
    return $rows
}

$catalogs = @(
    @{
        allowed_class = "warrior"
        weapon_family = "melee"
        damage_category = "strength"
        damage_output = "warrior_melee_weapon_ilvl_scaling_v2.csv"
        name_output = "warrior_melee_weapon_name_ranges_v4.csv"
        weapons = @(
            @{ name = "Iron Shortsword"; type = "Sword"; flavor = "A barracks blade still rough along the edge." },
            @{ name = "Brackenhilt"; type = "Sword"; flavor = "Forged thin and cheap for hands that still tremble." },
            @{ name = "Woodcutter's Axe"; type = "Axe"; flavor = "A woodsman's split iron turned toward flesh." },
            @{ name = "Greyfen Blade"; type = "Sword"; flavor = "Mud-stained steel that has only tasted petty duels." },
            @{ name = "Plainsteel Longsword"; type = "Sword"; flavor = "Reliable weight for those not yet tested by ruin." },
            @{ name = "Valdaryn"; type = "Sword"; flavor = "A provincial edge that holds against common mail." },
            @{ name = "Bearded War Axe"; type = "Axe"; flavor = "Its hooked beard drags shields from uncertain guards." },
            @{ name = "Redmark Sabre"; type = "Sword"; flavor = "Carved with faded sigils from border skirmishes." },
            @{ name = "Tempered Longblade"; type = "Sword"; flavor = "Tempered in ash pits where veteran ranks are named." },
            @{ name = "Frosthollow Axe"; type = "Axe"; flavor = "Cold iron that bites deeper after the first blood." },
            @{ name = "Damascus Steel"; type = "Sword"; flavor = "Layered metal whispering of patient and practiced kills." },
            @{ name = "Valenmark"; type = "Axe"; flavor = "A grim standard among wardens of besieged keeps." },
            @{ name = "Knight's Arming Sword"; type = "Sword"; flavor = "Balanced for tourneys yet hardened by real sieges." },
            @{ name = "Durnholde Axe"; type = "Axe"; flavor = "Each notch in its head marks a broken line of men." },
            @{ name = "Rivenspire Greatsword"; type = "Sword"; flavor = "Heavy steel sworn to mountain oaths and old banners." },
            @{ name = "Blackmoor Cleaver"; type = "Axe"; flavor = "Smoked black by peat fires and night executions." },
            @{ name = "Gilded Bastard Sword"; type = "Sword"; flavor = "Noble trim over a core built for ruthless work." },
            @{ name = "Harthorn"; type = "Axe"; flavor = "Its crescent edge howls through plate at full swing." },
            @{ name = "Highguard Claymore"; type = "Sword"; flavor = "A watchtower relic that cleaves as if judgment were law." },
            @{ name = "Stormvale Axe"; type = "Axe"; flavor = "Storm-battered steel that lands like a falling gate." },
            @{ name = "Silvermark Longblade"; type = "Sword"; flavor = "Etched silver lines glow when battle turns against you." },
            @{ name = "Dornhal Greataxe"; type = "Axe"; flavor = "An executioner's weight that silences armored prayer." },
            @{ name = "Crestfall Greatsword"; type = "Sword"; flavor = "Named for kingdoms that vanished under its measure." },
            @{ name = "Kingsreach Axe"; type = "Axe"; flavor = "A throne-breaker carried by oathless champions." },
            @{ name = "Imperial Warblade"; type = "Sword"; flavor = "An empire's final argument bound in star-dark steel." }
        )
    },
    @{
        allowed_class = "ranger"
        weapon_family = "ranged"
        damage_category = "agility"
        damage_output = "ranger_ranged_weapon_ilvl_scaling_v1.csv"
        name_output = "ranger_ranged_weapon_name_ranges_v3.csv"
        weapons = @(
            @{ name = "Twigbound Sling"; type = "Sling"; flavor = "Twisted cord and river stone for unsteady hunts." },
            @{ name = "Hollowsnap Sling"; type = "Sling"; flavor = "Its pouch tears often but still finds soft throats." },
            @{ name = "Briarloop Sling"; type = "Sling"; flavor = "Wound with thorn fiber and village superstition." },
            @{ name = "Fletchling Bow"; type = "Bow"; flavor = "A novice stave that sings only at close range." },
            @{ name = "Fenstring Bow"; type = "Bow"; flavor = "Swamp-drawn yew that bends for patient hands." },
            @{ name = "Mirewind Bow"; type = "Bow"; flavor = "Light in grip and cruel in ambush." },
            @{ name = "Watcher's Sling"; type = "Sling"; flavor = "Favored by wall scouts who never waste a stone." },
            @{ name = "Gorseflight Bow"; type = "Bow"; flavor = "Its arrows slip through brush like whispered threats." },
            @{ name = "Longreach Recurve"; type = "Bow"; flavor = "Built for ridge hunters that strike beyond horn calls." },
            @{ name = "Shardwhistle Sling"; type = "Sling"; flavor = "Chips of iron whistle before they break bone." },
            @{ name = "Duskmantle Bow"; type = "Bow"; flavor = "Dark lacquer hides the bow from moonlit sentries." },
            @{ name = "Carrionstep Recurve"; type = "Bow"; flavor = "Its shafts arrive where vultures already circle." },
            @{ name = "Skylash Longbow"; type = "Bow"; flavor = "Drawn to full arc it cracks like dry thunder." },
            @{ name = "Silent Quarry Sling"; type = "Sling"; flavor = "A poacher's tool made deadly by perfect timing." },
            @{ name = "Ravenline Bow"; type = "Bow"; flavor = "Feather-black limbs and a pull that spares no lung." },
            @{ name = "Ironbloom Recurve"; type = "Bow"; flavor = "Reinforced tips punish the careless and the armored alike." },
            @{ name = "Thornwake Longbow"; type = "Bow"; flavor = "Each release feels like drawing blood from a briar crown." },
            @{ name = "Dreadfletch Bow"; type = "Bow"; flavor = "A hunter's oath bound to dusk and open ribs." },
            @{ name = "Wolfsight Sling"; type = "Sling"; flavor = "Its rhythm mimics the patient heartbeat before a pounce." },
            @{ name = "Moonscar Recurve"; type = "Bow"; flavor = "Pale runes along the grip mark undefeated trails." },
            @{ name = "Ashfall Longbow"; type = "Bow"; flavor = "Its pull endures even in fire and siege smoke." },
            @{ name = "Grimtrail Bow"; type = "Bow"; flavor = "Used by wardens who leave no witness at dawn." },
            @{ name = "Kingshade Recurve"; type = "Bow"; flavor = "The shot is quiet until it ends a bloodline." },
            @{ name = "Black Meridian Bow"; type = "Bow"; flavor = "A starless relic that threads death through iron slits." },
            @{ name = "Eclipsed Huntmaster"; type = "Bow"; flavor = "The final bow of the unseen court of cinders." }
        )
    },
    @{
        allowed_class = "mage"
        weapon_family = "arcane"
        damage_category = "intelligence"
        damage_output = "mage_arcane_weapon_ilvl_scaling_v1.csv"
        name_output = "mage_arcane_weapon_name_ranges_v3.csv"
        weapons = @(
            @{ name = "Sootwood Wand"; type = "Wand"; flavor = "A cinder wand that sparks more than it obeys." },
            @{ name = "Dormant Hazel Wand"; type = "Wand"; flavor = "The grain hums faintly under uncertain incantations." },
            @{ name = "Cinderprick Wand"; type = "Wand"; flavor = "Its tip spits embers and petty spite." },
            @{ name = "Ashbound Rod"; type = "Staff"; flavor = "Bound in ash thread and apprentice mistakes." },
            @{ name = "Mothglass Wand"; type = "Wand"; flavor = "Clouded crystal that feeds on careless focus." },
            @{ name = "Hollow Reed Staff"; type = "Staff"; flavor = "A lean staff fit for hedge rites and ward circles." },
            @{ name = "Runebit Wand"; type = "Wand"; flavor = "Runes etched shallow yet eager to wound." },
            @{ name = "Gravewax Focus"; type = "Wand"; flavor = "Wax seals melt when the spellwork turns severe." },
            @{ name = "Duskbranch Staff"; type = "Staff"; flavor = "Cut from a tree that never saw noon." },
            @{ name = "Starveil Wand"; type = "Wand"; flavor = "A dim shard that remembers older constellations." },
            @{ name = "Sable Cantor"; type = "Staff"; flavor = "Its pulse steadies rites that would break lesser minds." },
            @{ name = "Umber Sigil Staff"; type = "Staff"; flavor = "Each sigil darkens after a successful invocation." },
            @{ name = "Penumbral Wand"; type = "Wand"; flavor = "Light bends around its core and vanishes." },
            @{ name = "Hexwarden Staff"; type = "Staff"; flavor = "Kept by magi tasked with ending cursed bloodlines." },
            @{ name = "Noctis Rod"; type = "Staff"; flavor = "A midnight conduit that devours stray sparks." },
            @{ name = "Oblivion Thyrse"; type = "Staff"; flavor = "Its crown blooms when enemies forget their names." },
            @{ name = "Eclipsed Scepter"; type = "Wand"; flavor = "An eclipsed shard that answers only firm command." },
            @{ name = "Aetherwake Staff"; type = "Staff"; flavor = "Arcane wake trails behind every spoken glyph." },
            @{ name = "Voidbloom Wand"; type = "Wand"; flavor = "Dark petals unfold when a duel nears its end." },
            @{ name = "Cathedral Spire"; type = "Staff"; flavor = "A high staff that tolls unseen bells through marrow." },
            @{ name = "Seraphim Ashrod"; type = "Staff"; flavor = "Sanctified ash burns brighter in forbidden rites." },
            @{ name = "Abyssal Choir Wand"; type = "Wand"; flavor = "Whispers gather at its tip before the cast." },
            @{ name = "Oracle's Eclipse"; type = "Staff"; flavor = "A prophetic stave that splits fate in two." },
            @{ name = "Crown of Drowned Light"; type = "Staff"; flavor = "Its halo drowns torches and courtly lies alike." },
            @{ name = "Dominion Arcanum"; type = "Staff"; flavor = "A sovereign conduit for spells that level citadels." }
        )
    }
)

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

foreach ($catalog in $catalogs) {
    $category = [string]$catalog.damage_category
    if (-not $spreadByCategory.ContainsKey($category)) {
        throw "Missing template spread profile for damage category '$category'."
    }

    $spreadPct = [double]$spreadByCategory[$category]
    $damageRows = New-DamageRows `
        -DamageCategory $category `
        -SpreadPct $spreadPct `
        -FromIlvl $startIlvl `
        -ToIlvl $endIlvl `
        -BaseAvg $baseAvgCommon `
        -AvgGrowth $avgGrowthPerIlvl `
        -CreationVariance $creationVariancePct `
        -RarityDefs $rarities

    $nameRows = New-NameRows `
        -WeaponFamily ([string]$catalog.weapon_family) `
        -AllowedClass ([string]$catalog.allowed_class) `
        -DamageCategory $category `
        -Weapons $catalog.weapons `
        -MaxLevel $LevelCap

    $damageOutputPath = Join-Path $OutputDir ([string]$catalog.damage_output)
    $nameOutputPath = Join-Path $OutputDir ([string]$catalog.name_output)
    $damageRows | Export-Csv -Path $damageOutputPath -NoTypeInformation
    $nameRows | Export-Csv -Path $nameOutputPath -NoTypeInformation

    Write-Output "Wrote $($damageRows.Count) rows to $damageOutputPath"
    Write-Output "Wrote $($nameRows.Count) rows to $nameOutputPath"
}
