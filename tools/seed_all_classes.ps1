#Requires -Version 5.1
<#
.SYNOPSIS
  Creates one guest account per player class so all 9 class icons are visible in-game.
  Requires the local stack to be running (run-local.bat).

.USAGE
  .\tools\seed_all_classes.ps1
  .\tools\seed_all_classes.ps1 -ApiUrl "http://localhost:4000"
#>

param(
  [string]$ApiUrl = "http://localhost:4000"
)

$classes = @(
  @{ id = "seed-juggernaut";  class = "juggernaut"  },
  @{ id = "seed-sentinel";    class = "sentinel"     },
  @{ id = "seed-reaver";      class = "reaver"       },
  @{ id = "seed-shade";       class = "shade"        },
  @{ id = "seed-arbalist";    class = "arbalist"     },
  @{ id = "seed-disciple";    class = "disciple"     },
  @{ id = "seed-runecaster";  class = "runecaster"   },
  @{ id = "seed-voidcaster";  class = "voidcaster"   },
  @{ id = "seed-arcanist";    class = "arcanist"     }
)

Write-Host "Seeding all 9 class accounts against $ApiUrl ..."

foreach ($entry in $classes) {
  $body = @{ guestId = $entry.id; class = $entry.class } | ConvertTo-Json
  try {
    $resp = Invoke-RestMethod -Method POST -Uri "$ApiUrl/v1/dev/guest-login" `
      -ContentType "application/json" -Body $body
    $token = $resp.accessToken
    Write-Host "  [OK] $($entry.class.PadRight(12)) -> token: $($token.Substring(0, [Math]::Min(30, $token.Length)))..."
  } catch {
    $status = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.value__ } else { "N/A" }
    Write-Warning "  [FAIL] $($entry.class) - HTTP $status : $($_.Exception.Message)"
  }
}

Write-Host ""
Write-Host "Done. Open the leaderboard in the web app to see all 9 class icons."
Write-Host "All 9 accounts use guestId 'seed-<classname>' - log in via the dev guest login in the UI."
