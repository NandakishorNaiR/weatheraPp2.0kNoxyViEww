<#
Usage:
  - To create a venv only: `powershell -File .\activate_env.ps1 -CreateOnly`
  - To activate in current PowerShell session: dot-source this file:
      `. .\activate_env.ps1`
This script will create a `.venv` directory if missing and then dot-source the venv's Activate.ps1.
#>
param(
    [switch]$CreateOnly
)

$venvPath = Join-Path $PSScriptRoot ".venv"
if (-not (Test-Path $venvPath)) {
    Write-Host "Creating virtual environment at $venvPath..."
    python -m venv $venvPath
    if ($LASTEXITCODE -ne 0) { Write-Error "Failed to create virtual environment."; exit 1 }
}

if ($CreateOnly) {
    Write-Host "Virtual environment created at $venvPath. To activate, dot-source this script:" 
    Write-Host ". .\activate_env.ps1"
    return
}

$activateScript = Join-Path $venvPath "Scripts\Activate.ps1"
if (-not (Test-Path $activateScript)) {
    Write-Error "Activation script not found at $activateScript"
    exit 1
}

# Dot-source the venv activation script into the current session. IMPORTANT: run this wrapper with a leading dot to affect your shell: `. .\activate_env.ps1`
. $activateScript

Write-Host "Activated virtual environment at $venvPath"
