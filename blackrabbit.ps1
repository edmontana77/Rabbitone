# ============================================================
# Black Rabbit Vulnerability Scan - Build Script
# Builds portable .exe files for Windows Server 2022 / Windows 10/11
# ============================================================
# Usage (run in PowerShell as Administrator recommended):
#   cd C:\BlackRabbit
#   .\build.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Black Rabbit Vulnerability Scan - Build Script" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check Python
try {
    $pythonVersion = python --version 2>&1
    Write-Host "[+] Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "[!] Python is not installed or not in PATH." -ForegroundColor Red
    Write-Host "    Download Python 3.11 or 3.12 from https://www.python.org/downloads/windows/" -ForegroundColor Yellow
    Write-Host "    Make sure to check 'Add python.exe to PATH' during installation." -ForegroundColor Yellow
    exit 1
}

# Create / activate virtual environment
$venvPath = Join-Path $ProjectRoot "venv"
if (-not (Test-Path $venvPath)) {
    Write-Host "[*] Creating virtual environment..." -ForegroundColor Yellow
    python -m venv $venvPath
}

Write-Host "[*] Activating virtual environment..." -ForegroundColor Yellow
$activateScript = Join-Path $venvPath "Scripts\Activate.ps1"
& $activateScript

# Upgrade pip and install dependencies
Write-Host "[*] Installing / upgrading build tools..." -ForegroundColor Yellow
python -m pip install --upgrade pip --quiet
pip install pyinstaller --quiet

# Optional: netmiko for Cisco support (not required for basic Windows pilot)
# pip install netmiko --quiet

Write-Host ""
Write-Host "[*] Building BlackRabbit-Server.exe ..." -ForegroundColor Cyan

# Clean previous builds for this target
$distDir = Join-Path $ProjectRoot "dist"
$buildDir = Join-Path $ProjectRoot "build"

# Build Central Server
pyinstaller --noconfirm --onefile --console `
    --name "BlackRabbit-Server" `
    --add-data "static;static" `
    --add-data "shared;shared" `
    --hidden-import "shared.logo_b64" `
    --hidden-import "shared.models" `
    --hidden-import "shared.report_utils" `
    --distpath $distDir `
    --workpath (Join-Path $buildDir "server") `
    --specpath (Join-Path $buildDir "server") `
    (Join-Path $ProjectRoot "server\central_server.py")

if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] Failed to build BlackRabbit-Server.exe" -ForegroundColor Red
    exit 1
}

Write-Host "[+] BlackRabbit-Server.exe built successfully" -ForegroundColor Green
Write-Host ""

Write-Host "[*] Building BlackRabbit-WindowsAgent.exe ..." -ForegroundColor Cyan

# Build Windows Agent
pyinstaller --noconfirm --onefile --console `
    --name "BlackRabbit-WindowsAgent" `
    --add-data "shared;shared" `
    --hidden-import "shared.logo_b64" `
    --hidden-import "shared.models" `
    --hidden-import "shared.report_utils" `
    --distpath $distDir `
    --workpath (Join-Path $buildDir "agent") `
    --specpath (Join-Path $buildDir "agent") `
    (Join-Path $ProjectRoot "agent\windows_agent.py")

if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] Failed to build BlackRabbit-WindowsAgent.exe" -ForegroundColor Red
    exit 1
}

Write-Host "[+] BlackRabbit-WindowsAgent.exe built successfully" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  BUILD COMPLETE" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Executables are located in:" -ForegroundColor White
Write-Host "  $distDir" -ForegroundColor Yellow
Write-Host ""
Write-Host "  - BlackRabbit-Server.exe          (Central server + web portal)" -ForegroundColor White
Write-Host "  - 
... 