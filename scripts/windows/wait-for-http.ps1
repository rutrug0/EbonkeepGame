param(
    [Parameter(Mandatory = $true)]
    [string]$Url,
    [int]$TimeoutSeconds = 60
)

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while ((Get-Date) -lt $deadline) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
            Write-Output "HTTP endpoint is reachable: $Url"
            exit 0
        }
    } catch {
    }
    Start-Sleep -Milliseconds 1000
}

Write-Error ("Timed out waiting for {0}" -f $Url)
exit 1
