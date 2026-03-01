param(
    [Parameter(Mandatory = $true)]
    [string]$HostName,
    [Parameter(Mandatory = $true)]
    [int]$Port,
    [int]$TimeoutSeconds = 60
)

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while ((Get-Date) -lt $deadline) {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $async = $client.BeginConnect($HostName, $Port, $null, $null)
        $success = $async.AsyncWaitHandle.WaitOne(800)
        if ($success -and $client.Connected) {
            $client.EndConnect($async)
            $client.Close()
            Write-Output "Port $Port on $HostName is reachable."
            exit 0
        }
        $client.Close()
    } catch {
    }
    Start-Sleep -Milliseconds 1000
}

Write-Error ("Timed out waiting for {0}:{1}" -f $HostName, $Port)
exit 1
