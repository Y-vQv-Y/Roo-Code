[CmdletBinding()]
param(
    [string]$Repository = $env:ADTEC_CODE_RELEASE_REPOSITORY,
    [string]$Version = $env:ADTEC_CODE_VERSION,
    [string]$LocalArchive = $env:ADTEC_CODE_LOCAL_ARCHIVE,
    [string]$InstallDir = $env:ADTEC_CODE_INSTALL_DIR,
    [string]$BinDir = $env:ADTEC_CODE_BIN_DIR
)

$ErrorActionPreference = "Stop"
$platform = "windows-x64"
$archiveName = "adtec-code-cli-$platform.zip"
$resolver = Join-Path $PSScriptRoot "scripts\resolve-release.mjs"
$minNodeMajor = 20
$localBase = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { $HOME }

if (-not $InstallDir) {
    $InstallDir = Join-Path $localBase "ADTEC Code\cli"
}
if (-not $BinDir) {
    $BinDir = Join-Path $localBase "ADTEC Code\bin"
}

function Fail([string]$Message) {
    throw $Message
}

function Get-NodeMajorVersion {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Fail "Node.js $minNodeMajor or higher is required."
    }

    $rawVersion = (& node --version).Trim()
    if ($rawVersion -notmatch '^v(\d+)') {
        Fail "Unable to determine the installed Node.js version."
    }

    return [int]$Matches[1]
}

function Resolve-Release {
    if (-not $Repository) {
        Fail "Set ADTEC_CODE_RELEASE_REPOSITORY or use -LocalArchive."
    }

    $releasesUrl = "https://api.github.com/repos/$Repository/releases?per_page=100"
    $headers = @{ Accept = "application/vnd.github+json"; "User-Agent" = "adtec-code-cli" }
    $releasesJson = (Invoke-WebRequest -UseBasicParsing -Uri $releasesUrl -Headers $headers).Content
    $arguments = @($resolver, "--asset", $archiveName)
    if ($Version) {
        $arguments += @("--version", $Version)
    }

    $metadata = $releasesJson | & node @arguments
    if (-not $metadata) {
        Fail "Could not find a CLI release containing $archiveName."
    }

    return $metadata | ConvertFrom-Json
}

if ((Get-NodeMajorVersion) -lt $minNodeMajor) {
    Fail "Node.js $minNodeMajor or higher is required."
}

$architecture = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
if ($architecture -ne "X64") {
    Fail "Only Windows x64 is currently supported. Detected: $architecture"
}

$temporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("adtec-code-cli-" + [guid]::NewGuid())
$archivePath = Join-Path $temporaryDirectory $archiveName
$extractDirectory = Join-Path $temporaryDirectory "extract"
New-Item -ItemType Directory -Path $temporaryDirectory -Force | Out-Null

try {
    if ($LocalArchive) {
        if (-not (Test-Path -LiteralPath $LocalArchive -PathType Leaf)) {
            Fail "Local archive not found: $LocalArchive"
        }
        Copy-Item -LiteralPath $LocalArchive -Destination $archivePath -Force
        $resolvedVersion = if ($Version) { $Version } else { "local" }
    } else {
        $release = Resolve-Release
        $resolvedVersion = $release.version
        Invoke-WebRequest -UseBasicParsing -Uri $release.url -OutFile $archivePath
    }

    Expand-Archive -LiteralPath $archivePath -DestinationPath $extractDirectory -Force
    $sourceDirectory = Join-Path $extractDirectory "adtec-code-cli-$platform"
    if (-not (Test-Path -LiteralPath $sourceDirectory -PathType Container)) {
        Fail "Archive is missing the expected directory: $sourceDirectory"
    }

    if (Test-Path -LiteralPath $InstallDir) {
        Remove-Item -LiteralPath $InstallDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path (Split-Path -Parent $InstallDir) -Force | Out-Null
    Move-Item -LiteralPath $sourceDirectory -Destination $InstallDir

    Push-Location $InstallDir
    try {
        & npm install --omit=dev --silent
        if ($LASTEXITCODE -ne 0) {
            Fail "npm install failed."
        }
    } finally {
        Pop-Location
    }

    New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
    $commandPath = Join-Path $InstallDir "bin\adtec-code.cmd"
    $shimPath = Join-Path $BinDir "adtec-code.cmd"
    $shim = "@echo off`r`ncall `"$commandPath`" %*`r`nexit /b %ERRORLEVEL%`r`n"
    Set-Content -LiteralPath $shimPath -Value $shim -Encoding Ascii -NoNewline

    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $pathEntries = @($userPath -split ";" | Where-Object { $_ })
    if ($pathEntries -notcontains $BinDir) {
        [Environment]::SetEnvironmentVariable("Path", (($pathEntries + $BinDir) -join ";"), "User")
    }
    $env:Path = "$BinDir;$env:Path"

    & $shimPath --version | Out-Host
    if ($LASTEXITCODE -ne 0) {
        Fail "Installed CLI failed the --version check."
    }

    Write-Host "ADTEC Code CLI $resolvedVersion installed at $InstallDir"
    Write-Host "Run: adtec-code --help"
} finally {
    if (Test-Path -LiteralPath $temporaryDirectory) {
        Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force
    }
}
