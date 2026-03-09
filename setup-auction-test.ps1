# Quick Setup Script for Auction House Testing
# Usage: .\setup-auction-test.ps1

Write-Host "🔨 Auction House Test Setup" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Step 1: Generate test data
Write-Host "[1/3] Creating test players and items..." -ForegroundColor Yellow
Push-Location apps\api
$output = npx tsx src/modules/auction/test-data.ts setup 2>&1
Write-Host $output
Pop-Location

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to create test data" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Test data created`n" -ForegroundColor Green

# Step 2: Create auctions
Write-Host "[2/3] Creating auction instances..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

$response = Invoke-RestMethod -Uri "http://localhost:4000/v1/auction/test/create-auctions" -Method Post -ErrorAction SilentlyContinue

if ($response.success) {
    Write-Host "✅ Auctions created`n" -ForegroundColor Green
} else {
    Write-Host "⚠️  Failed to create auctions. Is the API running on port 4000?" -ForegroundColor Red
    Write-Host "Please run: .\run-local.bat`n" -ForegroundColor Yellow
    exit 1
}

# Step 3: Verify
Write-Host "[3/3] Verifying setup..." -ForegroundColor Yellow
$config = Invoke-RestMethod -Uri "http://localhost:4000/v1/auction/config" -ErrorAction SilentlyContinue

if ($config) {
    Write-Host "✅ Auction system ready`n" -ForegroundColor Green
    
    Write-Host "📊 Configuration:" -ForegroundColor Cyan
    Write-Host "  - Auction times (UTC): $($config.config.instance.auctionStartTimesUtc -join ', ')"
    Write-Host "  - Duration: $($config.config.instance.auctionDurationHours) hours"
    Write-Host "  - Snipe protection: $($config.config.snipeProtection.enabled)"
    Write-Host "  - House fee: $($config.config.fees.auctionHouseFeePercent)%`n"
}

# Final instructions
Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host "================================`n" -ForegroundColor Cyan

Write-Host "Next steps:" -ForegroundColor White
Write-Host "1. Open http://localhost:5173 in your browser" -ForegroundColor White
Write-Host "2. Log in with your account" -ForegroundColor White
Write-Host "3. Click on 'Auction House' in the navigation" -ForegroundColor White
Write-Host "4. Browse auctions and place bids!`n" -ForegroundColor White

Write-Host "📖 Full testing guide: AUCTION_TESTING_GUIDE.md`n" -ForegroundColor Cyan

Write-Host "To add more random bids:" -ForegroundColor Gray
Write-Host "  cd apps\api" -ForegroundColor Gray
Write-Host "  npx tsx src/modules/auction/test-data.ts bids 10 20" -ForegroundColor Gray
Write-Host ""
