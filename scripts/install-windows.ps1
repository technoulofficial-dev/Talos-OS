# Talos OS — Windows PowerShell Self-Installer
# The Bronze Automaton · Metis Corp
#
# Usage: irm https://talos.metis.corp/install.ps1 | iex
# Or:    .\install-windows.ps1

$ErrorActionPreference = "Stop"

$TalosVersion = "8.0.0"
$InstallDir = if ($env:TALOS_HOME) { $env:TALOS_HOME } else { "$HOME\.talos" }
$GitHubRepo = "metis-corp/talos-os"

# Bronze-Punk colors
$Bronze = "DarkYellow"
$Cyan = "Cyan"
$Green = "Green"
$Yellow = "Yellow"
$Red = "Red"

function Show-Banner {
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor $Bronze
    Write-Host "║  ⚒  T A L O S  O S  I N S T A L L E R  ⚒                  ║" -ForegroundColor $Bronze
    Write-Host "║  The Bronze Automaton · Metis Corp                          ║" -ForegroundColor $Bronze
    Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor $Bronze
    Write-Host ""
}

function Write-Log {
    param([string]$Message)
    Write-Host "[talos] $Message" -ForegroundColor $Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[✓] $Message" -ForegroundColor $Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[!] $Message" -ForegroundColor $Yellow
}

function Write-Fail {
    param([string]$Message)
    Write-Host "[✗] $Message" -ForegroundColor $Red
    exit 1
}

function Test-Requirements {
    Write-Log "Checking system requirements..."

    if (-not $IsWindows -and -not ([Environment]::OSVersion.Platform -eq "Win32NT")) {
        Write-Fail "This installer is for Windows. For Linux, use install-ubuntu.sh"
    }

    foreach ($cmd in @("git", "node", "pnpm")) {
        if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
            Write-Fail "Required command not found: $cmd. Please install it first."
        }
    }

    # Check Node version
    $nodeVersion = (node --version) -replace 'v', ''
    $nodeMajor = [int]($nodeVersion -split '\.')[0]
    if ($nodeMajor -lt 20) {
        Write-Fail "Node.js 20+ required. Found: $(node --version)"
    }

    Write-Success "System requirements met"
}

function Install-Docker {
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        Write-Success "Docker already installed: $(docker --version)"
        return
    }

    Write-Log "Installing Docker Desktop..."
    Write-Warning "Please download and install Docker Desktop from https://www.docker.com/products/docker-desktop"
    Write-Warning "After installation, restart this script."
    Start-Process "https://www.docker.com/products/docker-desktop"
    exit 0
}

function Install-Ollama {
    if (Get-Command ollama -ErrorAction SilentlyContinue) {
        Write-Success "Ollama already installed"
        return
    }

    Write-Log "Installing Ollama (local AI engine)..."
    $ollamaUrl = "https://ollama.com/download/OllamaSetup.exe"
    $ollamaInstaller = "$env:TEMP\OllamaSetup.exe"
    Invoke-WebRequest -Uri $ollamaUrl -OutFile $ollamaInstaller
    Start-Process -FilePath $ollamaInstaller -Wait
    Write-Success "Ollama installed"
}

function New-Directories {
    Write-Log "Creating Talos directories at $InstallDir..."
    foreach ($subdir in @("agents", "blueprint", "memory", "plugins", "logs", "config")) {
        $path = Join-Path $InstallDir $subdir
        if (-not (Test-Path $path)) {
            New-Item -ItemType Directory -Path $path -Force | Out-Null
        }
    }
    Write-Success "Directories created"
}

function Get-Talos {
    Write-Log "Downloading Talos OS v$TalosVersion..."

    if (Test-Path (Join-Path $InstallDir ".git")) {
        Write-Log "Talos already cloned, updating..."
        Push-Location $InstallDir
        git pull origin main
        Pop-Location
    } else {
        git clone "https://github.com/$GitHubRepo.git" $InstallDir
    }

    Write-Success "Talos OS downloaded"
}

function Install-Dependencies {
    Write-Log "Installing dependencies..."
    Push-Location $InstallDir
    pnpm install --frozen-lockfile
    Pop-Location
    Write-Success "Dependencies installed"
}

function Set-Environment {
    Write-Log "Setting up environment..."

    $envFile = Join-Path $InstallDir ".env"
    $exampleFile = Join-Path $InstallDir ".env.example"

    if ((-not (Test-Path $envFile)) -and (Test-Path $exampleFile)) {
        Copy-Item $exampleFile $envFile
        Write-Log "Created .env file. Please edit it with your Supabase credentials."
    }

    # Add to user PATH
    $cliPath = Join-Path $InstallDir "packages\cli\dist"
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($currentPath -notlike "*$cliPath*") {
        [Environment]::SetEnvironmentVariable("Path", "$currentPath;$cliPath", "User")
        Write-Success "Added Talos to PATH"
    }

    [Environment]::SetEnvironmentVariable("TALOS_HOME", $InstallDir, "User")
}

function Start-Talos {
    Write-Log "Starting Talos OS for the first time..."
    Push-Location $InstallDir

    Write-Log "Building Talos packages..."
    pnpm build

    Write-Log "Starting services..."
    $cliExe = Join-Path $InstallDir "packages\cli\dist\index.js"
    & node $cliExe start --detach

    Pop-Location
}

function Show-PostInstall {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor $Bronze
    Write-Host "  ⚒ Talos OS v$TalosVersion installed successfully! ⚒" -ForegroundColor $Green
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor $Bronze
    Write-Host ""
    Write-Host "  Mission Control: " -NoNewline -ForegroundColor $Cyan
    Write-Host "http://localhost:3000"
    Write-Host "  HTTP API:        " -NoNewline -ForegroundColor $Cyan
    Write-Host "http://localhost:8642"
    Write-Host "  CLI:             " -NoNewline -ForegroundColor $Cyan
    Write-Host "talos <command>"
    Write-Host ""
    Write-Host "  Next steps:" -ForegroundColor $Yellow
    Write-Host "  1. Edit $InstallDir\.env with your Supabase credentials"
    Write-Host "  2. Run: talos start"
    Write-Host "  3. Open http://localhost:3000 in your browser"
    Write-Host ""
    Write-Host "  Optional Design Tools (for brand-grade UI generation):" -ForegroundColor $Yellow
    Write-Host "  4. pnpm od:install       — install open-design daemon (port 7456)"
    Write-Host "  5. pnpm magic:check      — verify 21st.dev API key is set in env"
    Write-Host "  6. Restart opencode     — loads the new magic + open-design MCPs"
    Write-Host ""
    Write-Host "  The Bronze Automaton awaits." -ForegroundColor $Bronze
    Write-Host ""
}

# Main
Show-Banner
Test-Requirements
Install-Docker
Install-Ollama
New-Directories
Get-Talos
Install-Dependencies
Set-Environment
Start-Talos
Show-PostInstall