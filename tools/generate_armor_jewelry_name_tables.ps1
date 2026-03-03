param(
    [string]$DataDir = "docs/data"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-NameWordCount {
    param([string]$Name)

    $parts = $Name.Trim().Split([char[]]" `t", [System.StringSplitOptions]::RemoveEmptyEntries)
    return $parts.Count
}

function Test-FlavorText {
    param([string]$Flavor)

    if ([string]::IsNullOrWhiteSpace($Flavor)) {
        return $false
    }

    if (-not $Flavor.EndsWith(".")) {
        return $false
    }

    $trimmed = $Flavor.Trim()
    # Allow 1-2 sentences for more lore buildup, but keep it strictly declarative.
    $periodCount = ([regex]::Matches($trimmed, '\.')).Count
    $bangCount = ([regex]::Matches($trimmed, "!")).Count
    $questionCount = ([regex]::Matches($trimmed, '\?')).Count
    $semicolonCount = ([regex]::Matches($trimmed, ';')).Count

    return ($periodCount -ge 1 -and $periodCount -le 2 -and $bangCount -eq 0 -and $questionCount -eq 0 -and $semicolonCount -eq 0)
}

function Validate-LevelWindow {
    param(
        [pscustomobject]$Row,
        [string]$TableName
    )

    $baseLevel = [int]$Row.base_level
    $dropMin = [int]$Row.drop_min_level
    $dropMaxRaw = [int]$Row.drop_max_level_raw
    $dropMaxCapped = [int]$Row.drop_max_level_capped

    $expectedDropMin = [Math]::Max(0, $baseLevel - 10)
    $expectedDropMaxRaw = $baseLevel + 10
    $expectedDropMaxCapped = [Math]::Min(100, $expectedDropMaxRaw)

    if ($dropMin -ne $expectedDropMin -or $dropMaxRaw -ne $expectedDropMaxRaw -or $dropMaxCapped -ne $expectedDropMaxCapped) {
        throw "${TableName}: sequence $($Row.sequence) has invalid level window (base=$baseLevel, min=$dropMin, maxRaw=$dropMaxRaw, maxCap=$dropMaxCapped)."
    }
}

function Validate-CommonRules {
    param(
        [pscustomobject[]]$Rows,
        [string]$TableName,
        [string]$ExpectedMajorCategory,
        [int]$ExpectedRowCount
    )

    if ($Rows.Count -ne $ExpectedRowCount) {
        throw "${TableName}: expected $ExpectedRowCount rows, found $($Rows.Count)."
    }

    foreach ($row in $Rows) {
        if ($row.major_category -ne $ExpectedMajorCategory) {
            throw "${TableName}: sequence $($row.sequence) major_category must be '$ExpectedMajorCategory'."
        }

        $wordCount = Get-NameWordCount ([string]$row.item_name)
        if ($wordCount -lt 1 -or $wordCount -gt 2) {
            throw "${TableName}: sequence $($row.sequence) item_name must be 1-2 words (got '$($row.item_name)')."
        }

        $flavor = [string]$row.flavor_text
        if (-not (Test-FlavorText $flavor)) {
            throw "${TableName}: sequence $($row.sequence) flavor_text must be 1-2 sentences ending with '.', with no '!' '?' or ';'."
        }

        Validate-LevelWindow -Row $row -TableName $TableName
    }
}

function Validate-ArmorTable {
    param(
        [string]$Path,
        [string]$ExpectedArchetype,
        [string]$ExpectedAllowedClass
    )

    $rows = Import-Csv -Path $Path
    $tableName = [System.IO.Path]::GetFileName($Path)
    Validate-CommonRules -Rows $rows -TableName $tableName -ExpectedMajorCategory "armor" -ExpectedRowCount 175

    $expectedSlots = @("helmet", "upper_armor", "pauldrons", "gloves", "belt", "lower_armor", "boots")
    foreach ($slot in $expectedSlots) {
        $slotRows = @($rows | Where-Object { $_.slot_family -eq $slot })
        if ($slotRows.Count -ne 25) {
            throw "${tableName}: slot_family '$slot' must have 25 rows (found $($slotRows.Count))."
        }
    }

    foreach ($row in $rows) {
        if ($row.archetype -ne $ExpectedArchetype) {
            throw "${tableName}: sequence $($row.sequence) archetype must be '$ExpectedArchetype'."
        }
        if ($row.allowed_class -ne $ExpectedAllowedClass) {
            throw "${tableName}: sequence $($row.sequence) allowed_class must be '$ExpectedAllowedClass'."
        }
    }

    Write-Output "Validated $tableName ($($rows.Count) rows)."
}

function Validate-JewelryTable {
    param(
        [string]$Path,
        [string]$ExpectedArchetype,
        [string]$ExpectedItemType
    )

    $rows = Import-Csv -Path $Path
    $tableName = [System.IO.Path]::GetFileName($Path)
    Validate-CommonRules -Rows $rows -TableName $tableName -ExpectedMajorCategory "jewelry" -ExpectedRowCount 25

    foreach ($row in $rows) {
        if ($row.archetype -ne $ExpectedArchetype) {
            throw "${tableName}: sequence $($row.sequence) archetype must be '$ExpectedArchetype'."
        }
        if ($row.slot_family -ne $ExpectedArchetype) {
            throw "${tableName}: sequence $($row.sequence) slot_family must be '$ExpectedArchetype'."
        }
        if ($row.allowed_class -ne "all") {
            throw "${tableName}: sequence $($row.sequence) allowed_class must be 'all'."
        }
        if ($row.item_type -ne $ExpectedItemType) {
            throw "${tableName}: sequence $($row.sequence) item_type must be '$ExpectedItemType'."
        }
    }

    Write-Output "Validated $tableName ($($rows.Count) rows)."
}

$heavyPath = Join-Path $DataDir "heavy_armor_name_ranges_v1.csv"
$lightPath = Join-Path $DataDir "light_armor_name_ranges_v1.csv"
$robePath = Join-Path $DataDir "robe_armor_name_ranges_v1.csv"
$ringPath = Join-Path $DataDir "jewelry_ring_name_ranges_v1.csv"
$necklacePath = Join-Path $DataDir "jewelry_necklace_name_ranges_v1.csv"

foreach ($path in @($heavyPath, $lightPath, $robePath, $ringPath, $necklacePath)) {
    if (-not (Test-Path $path)) {
        throw "Required table not found: $path"
    }
}

Validate-ArmorTable -Path $heavyPath -ExpectedArchetype "heavy" -ExpectedAllowedClass "warrior"
Validate-ArmorTable -Path $lightPath -ExpectedArchetype "light" -ExpectedAllowedClass "ranger"
Validate-ArmorTable -Path $robePath -ExpectedArchetype "robe" -ExpectedAllowedClass "mage"
Validate-JewelryTable -Path $ringPath -ExpectedArchetype "ring" -ExpectedItemType "Ring"
Validate-JewelryTable -Path $necklacePath -ExpectedArchetype "necklace" -ExpectedItemType "Necklace"

Write-Output "All armor/jewelry name-range tables passed validation."
