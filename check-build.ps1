$ErrorActionPreference = "Stop"

# Backend build
Write-Host "Building backend..." -ForegroundColor Cyan
Set-Location backend
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Backend build failed!" -ForegroundColor Red
    Set-Location ..
    exit $LASTEXITCODE
}
Set-Location ..

# Frontend build
Write-Host "Building frontend..." -ForegroundColor Cyan
Set-Location frontend
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend build failed!" -ForegroundColor Red
    Set-Location ..
    exit $LASTEXITCODE
}
Set-Location ..

Write-Host "Build completed successfully!" -ForegroundColor Green








