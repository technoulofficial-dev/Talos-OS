# Talos OS — opencode launcher
# Loads .env into the current process, then launches opencode.
# Use this instead of running `opencode` directly so the MCPs
# (magic, open-design) inherit TWENTYFIRST_API_KEY and OD_DAEMON_URL.
#
# Usage:
#   pnpm dev:oc          (alias)
#   powershell -File scripts/start-opencode.ps1

$ErrorActionPreference = "Stop"
$envFile = Join-Path (Get-Location) ".env"

if (Test-Path $envFile) {
    Write-Host "[talos] Loading .env into current process..." -ForegroundColor Cyan
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#=]+?)\s*=\s*(.+?)\s*$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            if ($key -and $value) {
                [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
                $masked = if ($value.Length -gt 8) { $value.Substring(0, 8) + "..." } else { $value }
                Write-Host ("  {0} = {1}" -f $key, $masked) -ForegroundColor DarkGray
            }
        }
    }
} else {
    Write-Warning "[talos] No .env file at $envFile"
}

# Find opencode executable
$oc = Get-Command "opencode" -ErrorAction SilentlyContinue
if (-not $oc) {
    Write-Error "opencode not found in PATH. Install from https://opencode.ai"
    exit 1
}

Write-Host "[talos] Launching opencode..." -ForegroundColor Green
& $oc.Source $args
