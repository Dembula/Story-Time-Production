# Pull Vercel environment variables into .env.local
# Run from project root:  .\scripts\pull-vercel-env.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
  Write-Host "Vercel CLI not found. Install: npm i -g vercel" -ForegroundColor Red
  exit 1
}

Write-Host "Checking Vercel login..." -ForegroundColor Cyan
vercel whoami 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Not logged in. Opening browser login..." -ForegroundColor Yellow
  vercel login
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Login failed. Try again: vercel login" -ForegroundColor Red
    exit 1
  }
}

$backup = ".env.local.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
if (Test-Path ".env.local") {
  Copy-Item ".env.local" $backup
  Write-Host "Backed up existing .env.local to $backup" -ForegroundColor DarkGray
}

Write-Host "Pulling Production env -> .env.local ..." -ForegroundColor Cyan
vercel env pull .env.local --environment=production --yes
if ($LASTEXITCODE -ne 0) {
  Write-Host "env pull failed." -ForegroundColor Red
  exit 1
}

Write-Host "Done. Restart npm run dev if it is running." -ForegroundColor Green
Write-Host "Cloudflare vars (names only):" -ForegroundColor Cyan
Select-String -Path ".env.local" -Pattern "^CLOUDFLARE_" | ForEach-Object {
  $name = ($_.Line -split "=", 2)[0]
  Write-Host "  $name"
}
