# Quick Setup Script for Auction House Testing
# Usage: .\setup-auction-simple.ps1

Write-Host "====================================" -ForegroundColor Cyan
Write-Host " Auction House Test Setup" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Generate test data
Write-Host "[1/3] Creating test players and items..." -ForegroundColor Yellow
Push-Location apps\api
npx tsx src/modules/auction/test-data.ts setup
Pop-Location

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Failed to create test data" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "SUCCESS: Test data created" -ForegroundColor Green
Write-Host ""

# Step 2: Create auctions
Write-Host "[2/3] Creating auction instances..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

try {
    $headers = @{ "Content-Type" = "application/json" }
    $response = Invoke-RestMethod -Uri "http://localhost:4000/v1/auction/test/create-auctions" -Method Post -Headers $headers -Body "{}" -ErrorAction Stop
    
    if ($response.success) {
        Write-Host ""
        Write-Host "SUCCESS: Auctions created" -ForegroundColor Green
        Write-Host ""
    }
} catch {
    Write-Host ""
    Write-Host "WARNING: Failed to create auctions. Is the API running on port 4000?" -ForegroundColor Red
    Write-Host "Please run: .\run-local.bat" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Step 3: Verify
Write-Host "[3/3] Verifying setup..." -ForegroundColor Yellow

try {
    $config = Invoke-RestMethod -Uri "http://localhost:4000/v1/auction/config" -ErrorAction Stop
    
    Write-Host ""
    Write-Host "SUCCESS: Auction system ready" -ForegroundColor Green
    Write-Host ""
    Write-Host "Configuration:" -ForegroundColor Cyan
    Write-Host "  - Auction times (UTC): $($config.config.instance.auctionStartTimesUtc -join ', ')"
    Write-Host "  - Duration: $($config.config.instance.auctionDurationHours) hours"
    Write-Host "  - Snipe protection: $($config.config.snipeProtection.enabled)"
    Write-Host "  - House fee: $($config.config.fees.auctionHouseFeePercent)%"
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "WARNING: Could not verify config (API may be starting up)" -ForegroundColor Yellow
    Write-Host ""
}

# Final instructions
Write-Host "====================================" -ForegroundColor Green
Write-Host " Setup Complete!" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""

Write-Host "Next steps:" -ForegroundColor White
Write-Host "1. Open http://localhost:5173 in your browser"
Write-Host "2. Log in with your account"
Write-Host "3. Click on 'Auction House' in the navigation menu"
Write-Host "4. Browse auctions and place bids!"
Write-Host ""

Write-Host "To add more random bids, run:" -ForegroundColor Gray
Write-Host "  cd apps\api"
Write-Host "  npx tsx src/modules/auction/test-data.ts bids 10 20"
Write-Host ""
