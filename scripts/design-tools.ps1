[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("install", "open", "status", "tools", "magic-check")]
    [string]$Action
)

$ErrorActionPreference = "Stop"
$OdDownloadUrl  = "https://github.com/nexu-io/open-design/releases"
$OdAppName      = "Open Design"
$OdDefaultPort  = 7456
$OdDefaultUrl   = "http://localhost:$OdDefaultPort"

function Write-Banner {
    param([string]$Text)
    Write-Host ""
    Write-Host ("  --  {0}  --" -f $Text) -ForegroundColor DarkYellow
    Write-Host ""
}

function Test-Daemon {
    param([string]$Url)
    try {
        $response = Invoke-WebRequest -Uri "$Url/" -Method GET -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

switch ($Action) {
    "install" {
        Write-Banner "open-design installer"
        Write-Host "The open-design daemon ships with the open-design desktop app." -ForegroundColor Cyan
        Write-Host "It is NOT a standalone npm package -- install the GUI, the daemon auto-starts." -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Opening download page in your browser..." -ForegroundColor Yellow
        Start-Process $OdDownloadUrl
        Write-Host ""
        Write-Host "After install:" -ForegroundColor Green
        Write-Host ("  1. Launch the open-design app (daemon starts on port {0})" -f $OdDefaultPort) -ForegroundColor White
        Write-Host ("  2. Set OD_DAEMON_URL={0} in your environment" -f $OdDefaultUrl) -ForegroundColor White
        Write-Host "  3. Run: pnpm od:status   (verify daemon reachable)" -ForegroundColor White
        Write-Host "  4. Restart opencode to load the open-design MCP" -ForegroundColor White
    }

    "open" {
        Write-Banner "Launching open-design"
        $odExe = Get-Command "open-design" -ErrorAction SilentlyContinue
        if ($odExe) {
            Start-Process "open-design"
            Write-Host ("open-design launched. Daemon should come up on port {0} within ~5s." -f $OdDefaultPort) -ForegroundColor Green
        } else {
            Write-Host "open-design executable not found in PATH." -ForegroundColor Red
            Write-Host ("Install from: {0}" -f $OdDownloadUrl) -ForegroundColor Yellow
            Write-Host "Then run: pnpm od:install" -ForegroundColor Yellow
        }
    }

    "status" {
        Write-Banner "open-design daemon status"
        $url = if ($env:OD_DAEMON_URL) { $env:OD_DAEMON_URL } else { $OdDefaultUrl }
        Write-Host ("Probing {0} ..." -f $url) -ForegroundColor Cyan
        $reachable = Test-Daemon -Url $url
        if ($reachable) {
            Write-Host ("[OK] Daemon reachable at {0}" -f $url) -ForegroundColor Green
        } else {
            Write-Host ("[FAIL] Daemon NOT reachable at {0}" -f $url) -ForegroundColor Red
            Write-Host "  > Launch the open-design desktop app: pnpm od:open" -ForegroundColor Yellow
            Write-Host "  > Or install it first:               pnpm od:install" -ForegroundColor Yellow
            Write-Host "  > Or set OD_DAEMON_URL to a different host:port" -ForegroundColor Yellow
            exit 1
        }
    }

    "tools" {
        Write-Banner "open-design MCP tools"
        Write-Host "After restarting opencode with the open-design MCP enabled, you should see:" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  od_list_design_systems       -- list the 149+ prebuilt DESIGN.md ships" -ForegroundColor White
        Write-Host "  od_extract_design_system     -- pull tokens from a chosen ship (Linear, Vercel, etc.)" -ForegroundColor White
        Write-Host "  od_generate_design_system    -- generate a custom design from a brand brief" -ForegroundColor White
        Write-Host "  od_update_design_system      -- semantic edit on an existing system" -ForegroundColor White
        Write-Host "  od_compose_system_prompt     -- build the BYOK system prompt for an agent" -ForegroundColor White
        Write-Host "  od_preview_design            -- render an HTML preview in the daemon" -ForegroundColor White
        Write-Host "  od_export_artifact           -- export to HTML/PDF/PPTX/MP4" -ForegroundColor White
        Write-Host ""
        Write-Host "If the tools are not present, restart opencode (it does not hot-reload opencode.json)." -ForegroundColor Yellow
    }

    "magic-check" {
        Write-Banner "21st.dev Magic MCP check"
        if ([string]::IsNullOrWhiteSpace($env:TWENTYFIRST_API_KEY)) {
            Write-Host "[FAIL] TWENTYFIRST_API_KEY is NOT set" -ForegroundColor Red
            Write-Host "  > Sign up free at https://21st.dev/magic" -ForegroundColor Yellow
            Write-Host "  > Set TWENTYFIRST_API_KEY in your shell, then restart opencode" -ForegroundColor Yellow
            exit 1
        } else {
            $masked = $env:TWENTYFIRST_API_KEY.Substring(0, [Math]::Min(8, $env:TWENTYFIRST_API_KEY.Length)) + "..."
            Write-Host ("[OK] TWENTYFIRST_API_KEY is set ({0})" -f $masked) -ForegroundColor Green
            Write-Host "  > Restart opencode if the magic MCP tools are not visible yet" -ForegroundColor Yellow
        }
    }
}
