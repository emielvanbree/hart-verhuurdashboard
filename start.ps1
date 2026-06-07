Write-Host ""
Write-Host " ===================================================" -ForegroundColor Cyan
Write-Host "  Verhuurdashboard | 't Hart Verloskunde" -ForegroundColor Cyan
Write-Host " ===================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host " Stap 1: Afhankelijkheden installeren..." -ForegroundColor Yellow
npm install --ignore-scripts
Set-Location client
npm install
npm run build
Set-Location ..
Write-Host ""
Write-Host " Applicatie beschikbaar op: http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host " Inloggegevens (eerste keer):" -ForegroundColor White
Write-Host "   Admin:     admin@thart.nl / Admin123!" -ForegroundColor Gray
Write-Host "   Assistent: assistent@thart.nl / Assistent123!" -ForegroundColor Gray
Write-Host ""
npm start
