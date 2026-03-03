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
$baseLevelInfluenceWeight = [double]$cfg.base_level_influence_weight

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
        [double]$BaseLevelInfluenceWeight,
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
                    base_level_influence_weight = Round-2 $BaseLevelInfluenceWeight
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
        [int]$MaxLevel,
        [hashtable]$PromptByWeaponName
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
        $weaponName = [string]$Weapons[$i].name
        $promptItemDescription = ""

        if ($PromptByWeaponName.ContainsKey($weaponName)) {
            $promptItemDescription = [string]$PromptByWeaponName[$weaponName]
        }
        elseif ($Weapons[$i].ContainsKey("prompt_item_description")) {
            $promptItemDescription = [string]$Weapons[$i].prompt_item_description
        }

        $rows.Add([PSCustomObject]@{
                sequence = $idx
                weapon_name = $weaponName
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
                prompt_item_description = $promptItemDescription
            })
    }
    return $rows
}

function Get-PromptMapFromExistingNameTable {
    param(
        [string]$Path
    )

    $map = @{}
    if (-not (Test-Path $Path)) {
        return $map
    }

    $rows = Import-Csv -Path $Path
    foreach ($row in $rows) {
        if (-not $row.PSObject.Properties["prompt_item_description"]) {
            continue
        }
        $weaponName = ([string]$row.weapon_name).Trim()
        $prompt = ([string]$row.prompt_item_description).Trim()
        if ([string]::IsNullOrWhiteSpace($weaponName)) {
            continue
        }
        if ([string]::IsNullOrWhiteSpace($prompt)) {
            continue
        }
        if (-not $map.ContainsKey($weaponName)) {
            $map[$weaponName] = $prompt
        }
    }
    return $map
}

$catalogs = @(
    @{
        allowed_class = "warrior"
        weapon_family = "melee"
        damage_category = "strength"
        damage_output = "warrior_melee_weapon_ilvl_scaling_v2.csv"
        name_output = "warrior_melee_weapon_name_ranges_v4.csv"
        weapons = @(
            @{ name = "Iron Shortsword"; type = "Sword"; flavor = "Soft steel and a shy point serve until the first hard mistake." },
            @{ name = "Brackenhilt"; type = "Sword"; flavor = "Swamp stained wrap clings in rain. The grip holds, the will may not." },
            @{ name = "Woodcutter's Axe"; type = "Axe"; flavor = "A working head tied to a war haft bites without ceremony. Conscience is not part of the tool." },
            @{ name = "Greyfen Blade"; type = "Sword"; flavor = "Marsh grime lives under the guard, the edge looks tired. It still finds a gap when you do." },
            @{ name = "Plainsteel Longsword"; type = "Sword"; flavor = "Honest weight and plain balance offer no rescue. At least it will not shame you." },
            @{ name = "Valdaryn"; type = "Sword"; flavor = "A clean ring on the draw, the point obeys even when the mind protests." },
            @{ name = "Bearded War Axe"; type = "Axe"; flavor = "A hooked beard pries at shields and ankles. Defense turns to panic fast." },
            @{ name = "Redmark Sabre"; type = "Sword"; flavor = "Light enough to return twice before fear speaks. Stubborn wrists learn to like it." },
            @{ name = "Tempered Longblade"; type = "Sword"; flavor = "Heat darkened near the hilt, the edge holds longer than your temper." },
            @{ name = "Frosthollow Axe"; type = "Axe"; flavor = "Cold metal near any brazier makes the hands work harder. Crowds part, payment follows." },
            @{ name = "Damascus Steel"; type = "Sword"; flavor = "Watered lines hide old scars in the metal. Yours remain in the flesh." },
            @{ name = "Valenmark"; type = "Axe"; flavor = "A maker stamp on the cheek, a thumb groove worn smooth. Habit fits better than it should." },
            @{ name = "Knight's Arming Sword"; type = "Sword"; flavor = "Straight geometry carries its training dents like scripture. Little forgiveness, plenty of lessons." },
            @{ name = "Durnholde Axe"; type = "Axe"; flavor = "Head heavy and stubborn, the stroke keeps going after the hands want to quit. Quitting is expensive." },
            @{ name = "Rivenspire Greatsword"; type = "Sword"; flavor = "Built for crowded lines, it asks for both hands and gives back a spine." },
            @{ name = "Blackmoor Cleaver"; type = "Axe"; flavor = "Broad and mean, the cut makes short work of doubt. Sleep pays for the rest." },
            @{ name = "Gilded Bastard Sword"; type = "Sword"; flavor = "Gilt survives only in the recesses. The rest is worn clean by labor that bleeds." },
            @{ name = "Harthorn"; type = "Axe"; flavor = "Torn wrap hides splinters that never warm. The grip stays honest, the hand stays sore." },
            @{ name = "Highguard Claymore"; type = "Sword"; flavor = "A high guard made for tight corridors turns panic into posture. Then it asks you to hold." },
            @{ name = "Stormvale Axe"; type = "Axe"; flavor = "Salt pitted steel keeps its edge anyway. You can learn the same." },
            @{ name = "Silvermark Longblade"; type = "Sword"; flavor = "Balanced for the long hour and the last push. Discipline earns control, nothing else." },
            @{ name = "Dornhal Greataxe"; type = "Axe"; flavor = "Built for doors and shields, the blow lands like a sentence. Finish it." },
            @{ name = "Crestfall Greatsword"; type = "Sword"; flavor = "A broken crest rides the pommel, shame carried into the breach. It comes back cleaner." },
            @{ name = "Kingsreach Axe"; type = "Axe"; flavor = "Hook and crescent drag proud helms down to earth. Staying upright becomes a choice you can keep." },
            @{ name = "Imperial Warblade"; type = "Sword"; flavor = "Polished like ceremony and weighted like duty. A charge becomes a decision, and the decision becomes a line held." }
        )
    },
    @{
        allowed_class = "ranger"
        weapon_family = "ranged"
        damage_category = "agility"
        damage_output = "ranger_ranged_weapon_ilvl_scaling_v1.csv"
        name_output = "ranger_ranged_weapon_name_ranges_v3.csv"
        weapons = @(
            @{ name = "Twigbound Sling"; type = "Sling"; flavor = "Frayed cord and a pocket of bad leather throw stones badly. Hunger makes you keep trying." },
            @{ name = "Hollowsnap Sling"; type = "Sling"; flavor = "Dry air makes the cast crack. The sound keeps time when nerves do not." },
            @{ name = "Briarloop Sling"; type = "Sling"; flavor = "Briar knots bite the palm. Patience costs less than bandages." },
            @{ name = "Fletchling Bow"; type = "Bow"; flavor = "A small bow forgives bad form. It feeds the first weeks of hunger." },
            @{ name = "Fenstring Bow"; type = "Bow"; flavor = "Fog soaked limbs stay quiet, the string feels like wet rope. It still holds." },
            @{ name = "Mirewind Bow"; type = "Bow"; flavor = "Mud stained wraps and stubborn draw survive ditches better than men." },
            @{ name = "Watcher's Sling"; type = "Sling"; flavor = "Tally cuts from long watches keep the hand honest. Silence does the rest." },
            @{ name = "Gorseflight Bow"; type = "Bow"; flavor = "Thornwood nocks bite the finger. Slow down, or bleed." },
            @{ name = "Longreach Recurve"; type = "Bow"; flavor = "Hard pull and fast return make distance feel less cruel for a moment." },
            @{ name = "Shardwhistle Sling"; type = "Sling"; flavor = "A chipped bead whistles on the spin, just enough to steady breath." },
            @{ name = "Duskmantle Bow"; type = "Bow"; flavor = "Dark stain vanishes against bark, only the arrow gives you away." },
            @{ name = "Carrionstep Recurve"; type = "Bow"; flavor = "Built for running shots, the grip is polished by panic and rain." },
            @{ name = "Skylash Longbow"; type = "Bow"; flavor = "Made for open sky, it rewards calm hands and punishes haste." },
            @{ name = "Silent Quarry Sling"; type = "Sling"; flavor = "Soft pouch and dead cord keep quiet. A loud mistake would be final." },
            @{ name = "Ravenline Bow"; type = "Bow"; flavor = "Charcoal smears on the grip tell old fires. Wind turns mean, the draw stays true." },
            @{ name = "Ironbloom Recurve"; type = "Bow"; flavor = "Steel tucked into wood and sinew keeps its shape through cold mornings." },
            @{ name = "Thornwake Longbow"; type = "Bow"; flavor = "Splinters under the wrap warn restless fingers. Fidgeting pays in blood." },
            @{ name = "Dreadfletch Bow"; type = "Bow"; flavor = "Scarred at the handle from a bad day, it still draws without complaint." },
            @{ name = "Wolfsight Sling"; type = "Sling"; flavor = "Braided by sleepless hands, the sling feels ready at any hour. You learn to match it." },
            @{ name = "Moonscar Recurve"; type = "Bow"; flavor = "A pale burn on one limb tells its history. Work continues without apology." },
            @{ name = "Ashfall Longbow"; type = "Bow"; flavor = "Smoke in the grain and a steady center turn doubt into a straight line." },
            @{ name = "Grimtrail Bow"; type = "Bow"; flavor = "Heavy and steady, it was made for the last arrow you can afford. Take the shot." },
            @{ name = "Kingshade Recurve"; type = "Bow"; flavor = "Wrapped dark to hide the hands, it belongs to someone who learned to move unseen." },
            @{ name = "Black Meridian Bow"; type = "Bow"; flavor = "Straight in the draw and cruel in the release, distance starts feeling like power." },
            @{ name = "Eclipsed Huntmaster"; type = "Bow"; flavor = "Built for one clean kill at dusk. Silence is the price, certainty is the return." }
        )
    },
    @{
        allowed_class = "mage"
        weapon_family = "arcane"
        damage_category = "intelligence"
        damage_output = "mage_arcane_weapon_ilvl_scaling_v1.csv"
        name_output = "mage_arcane_weapon_name_ranges_v3.csv"
        weapons = @(
            @{ name = "Sootwood Wand"; type = "Wand"; flavor = "Charred at the tip from cheap practice still points true when the hand stops shaking." },
            @{ name = "Dormant Hazel Wand"; type = "Wand"; flavor = "Plain wood and patient balance teach restraint before power." },
            @{ name = "Cinderprick Wand"; type = "Wand"; flavor = "Pinprick burns in glove leather teach control by small losses." },
            @{ name = "Ashbound Rod"; type = "Staff"; flavor = "Ash packed rings keep the hands from slipping, heat is less a threat than haste." },
            @{ name = "Mothglass Wand"; type = "Wand"; flavor = "Cloudy glass catches lantern light and makes a poor room feel less hopeless." },
            @{ name = "Hollow Reed Staff"; type = "Staff"; flavor = "Tapped wood hums back, a strict tutor for rushed cadence." },
            @{ name = "Runebit Wand"; type = "Wand"; flavor = "Shallow grooves guide the fingers when the mind wanders." },
            @{ name = "Gravewax Focus"; type = "Wand"; flavor = "Wax and cold stone smell like work done past sleep." },
            @{ name = "Duskbranch Staff"; type = "Staff"; flavor = "Cracked varnish like dried riverbeds, it survives careless travel and careful use." },
            @{ name = "Starveil Wand"; type = "Wand"; flavor = "Silver flecks under lacquer hold a tiny sky. Ugly nights go quieter." },
            @{ name = "Sable Cantor"; type = "Staff"; flavor = "Made for spoken rites and steady breath. The voice breaks less." },
            @{ name = "Umber Sigil Staff"; type = "Staff"; flavor = "A smudged mark refuses to wash away. Mistakes leave evidence." },
            @{ name = "Penumbral Wand"; type = "Wand"; flavor = "Dark wrap and blunt cap, it keeps work contained when fear wants it wild." },
            @{ name = "Hexwarden Staff"; type = "Staff"; flavor = "Squared and heavy in the hand prefers clean decisions. Wavering costs more." },
            @{ name = "Noctis Rod"; type = "Staff"; flavor = "Cool metal teaches patience the hard way, pride finds no room." },
            @{ name = "Oblivion Thyrse"; type = "Staff"; flavor = "Bound tight at the head, the mind scatters less when sleep is thin." },
            @{ name = "Eclipsed Scepter"; type = "Wand"; flavor = "Ceremonial shape and a worn grip have seen more repetition than praise." },
            @{ name = "Aetherwake Staff"; type = "Staff"; flavor = "A narrow channel runs true along the shaft. Calm hands are rewarded, drift is exposed." },
            @{ name = "Voidbloom Wand"; type = "Wand"; flavor = "A dried bloom under glass remembers decay. Discipline stays." },
            @{ name = "Cathedral Spire"; type = "Staff"; flavor = "Tall and severe, even bold students stand straighter and speak less." },
            @{ name = "Seraphim Ashrod"; type = "Staff"; flavor = "Ash dark in the grip and steady in the air asks for composure, not courage." },
            @{ name = "Abyssal Choir Wand"; type = "Wand"; flavor = "Dark and singing in the grip turns fear into a held note. Silence follows." },
            @{ name = "Oracle's Eclipse"; type = "Staff"; flavor = "Ringed crown and clockwork patience keep the mind from chasing shadows." },
            @{ name = "Crown of Drowned Light"; type = "Staff"; flavor = "Glass and waterline stains carry weight like a vow. Match it." },
            @{ name = "Dominion Arcanum"; type = "Staff"; flavor = "Imposing and deliberate, it dares you to hold the line when the room goes silent." }
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
        -BaseLevelInfluenceWeight $baseLevelInfluenceWeight `
        -RarityDefs $rarities

    $damageOutputPath = Join-Path $OutputDir ([string]$catalog.damage_output)
    $nameOutputPath = Join-Path $OutputDir ([string]$catalog.name_output)
    $promptByWeaponName = Get-PromptMapFromExistingNameTable -Path $nameOutputPath

    $nameRows = New-NameRows `
        -WeaponFamily ([string]$catalog.weapon_family) `
        -AllowedClass ([string]$catalog.allowed_class) `
        -DamageCategory $category `
        -Weapons $catalog.weapons `
        -MaxLevel $LevelCap `
        -PromptByWeaponName $promptByWeaponName

    $damageRows | Export-Csv -Path $damageOutputPath -NoTypeInformation
    $nameRows | Export-Csv -Path $nameOutputPath -NoTypeInformation

    Write-Output "Wrote $($damageRows.Count) rows to $damageOutputPath"
    Write-Output "Wrote $($nameRows.Count) rows to $nameOutputPath"
}
