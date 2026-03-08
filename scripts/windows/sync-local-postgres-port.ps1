param(
    [string]$EnvPath = ".env",
    [int]$PreferredPort = 55432,
    [int]$FallbackStartPort = 55433,
    [int]$FallbackEndPort = 56000
)

if (-not (Test-Path $EnvPath)) {
    Write-Error ("Environment file not found: {0}" -f $EnvPath)
    exit 1
}

$raw = Get-Content -Raw -Path $EnvPath

function Get-EnvValue {
    param(
        [string]$Content,
        [string]$Name
    )

    $pattern = "(?m)^" + [regex]::Escape($Name) + "=(.*)$"
    $match = [regex]::Match($Content, $pattern)
    if ($match.Success) {
        return $match.Groups[1].Value.Trim()
    }

    return $null
}

function Set-EnvValue {
    param(
        [string]$Content,
        [string]$Name,
        [string]$Value
    )

    $line = "{0}={1}" -f $Name, $Value
    $pattern = "(?m)^" + [regex]::Escape($Name) + "=.*$"

    if ([regex]::IsMatch($Content, $pattern)) {
        return [regex]::Replace($Content, $pattern, $line, 1)
    }

    if ($Content.Length -gt 0 -and -not $Content.EndsWith("`n")) {
        $Content += [Environment]::NewLine
    }

    return $Content + $line + [Environment]::NewLine
}

function Test-PortBindable {
    param([int]$Port)

    $listener = $null
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("0.0.0.0"), $Port)
        $listener.Start()
        return $true
    } catch {
        return $false
    } finally {
        if ($null -ne $listener) {
            $listener.Stop()
        }
    }
}

$configuredPort = Get-EnvValue -Content $raw -Name "EBONKEEP_POSTGRES_HOST_PORT"
if (-not $configuredPort) {
    $dbUrlMatch = [regex]::Match($raw, '(?m)^DATABASE_URL=.*@localhost:(\d+)(?:/|\?)')
    if ($dbUrlMatch.Success) {
        $configuredPort = $dbUrlMatch.Groups[1].Value
    }
}

$candidatePorts = [System.Collections.Generic.List[int]]::new()

foreach ($candidate in @($configuredPort, $PreferredPort)) {
    $parsed = 0
    if ([int]::TryParse([string]$candidate, [ref]$parsed) -and -not $candidatePorts.Contains($parsed)) {
        $candidatePorts.Add($parsed)
    }
}

for ($port = $FallbackStartPort; $port -le $FallbackEndPort; $port++) {
    if (-not $candidatePorts.Contains($port)) {
        $candidatePorts.Add($port)
    }
}

$selectedPort = $null
foreach ($candidatePort in $candidatePorts) {
    if (Test-PortBindable -Port $candidatePort) {
        $selectedPort = $candidatePort
        break
    }
}

if ($null -eq $selectedPort) {
    Write-Error ("Could not find a bindable local Postgres host port in range {0}-{1}." -f $PreferredPort, $FallbackEndPort)
    exit 1
}

$raw = Set-EnvValue -Content $raw -Name "EBONKEEP_POSTGRES_HOST_PORT" -Value ([string]$selectedPort)
$databaseUrl = "postgresql://ebonkeep:ebonkeep@localhost:{0}/ebonkeep?schema=public" -f $selectedPort
$raw = Set-EnvValue -Content $raw -Name "DATABASE_URL" -Value $databaseUrl

Set-Content -Path $EnvPath -Value $raw -Encoding UTF8 -NoNewline
Write-Output $selectedPort
