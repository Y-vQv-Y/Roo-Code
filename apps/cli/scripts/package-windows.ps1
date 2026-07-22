[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Version,
    [string]$Platform = "windows-x64"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$releaseName = "adtec-code-cli-$Platform"
$releaseDirectory = Join-Path $repoRoot $releaseName
$archivePath = Join-Path $repoRoot "$releaseName.zip"

if (Test-Path -LiteralPath $releaseDirectory) {
    Remove-Item -LiteralPath $releaseDirectory -Recurse -Force
}
if (Test-Path -LiteralPath $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
}

$binDirectory = Join-Path $releaseDirectory "bin"
$libDirectory = Join-Path $releaseDirectory "lib"
$extensionDirectory = Join-Path $releaseDirectory "extension"
New-Item -ItemType Directory -Path $binDirectory, $libDirectory, $extensionDirectory -Force | Out-Null

Copy-Item -Path (Join-Path $repoRoot "apps\cli\dist\*") -Destination $libDirectory -Recurse -Force
Copy-Item -Path (Join-Path $repoRoot "src\dist\*") -Destination $extensionDirectory -Recurse -Force

$skillsDirectory = Join-Path $extensionDirectory "builtin-skills"
New-Item -ItemType Directory -Path $skillsDirectory -Force | Out-Null
Copy-Item -Path (Join-Path $repoRoot "src\builtin-skills\*") -Destination $skillsDirectory -Recurse -Force
Set-Content -LiteralPath (Join-Path $extensionDirectory "package.json") -Value '{"type":"commonjs"}' -Encoding Ascii

$sourcePackage = Get-Content -Raw -LiteralPath (Join-Path $repoRoot "apps\cli\package.json") | ConvertFrom-Json
$releasePackage = [ordered]@{
    name = "@adtec-code/cli"
    version = $Version
    type = "module"
    dependencies = [ordered]@{
        "@inkjs/ui" = $sourcePackage.dependencies."@inkjs/ui"
        "@trpc/client" = $sourcePackage.dependencies."@trpc/client"
        commander = $sourcePackage.dependencies.commander
        fuzzysort = $sourcePackage.dependencies.fuzzysort
        ink = $sourcePackage.dependencies.ink
        "p-wait-for" = $sourcePackage.dependencies."p-wait-for"
        react = $sourcePackage.dependencies.react
        superjson = $sourcePackage.dependencies.superjson
        zustand = $sourcePackage.dependencies.zustand
    }
}
$releasePackage | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $releaseDirectory "package.json") -Encoding Utf8

$ripgrepPath = Get-ChildItem -Path (Join-Path $repoRoot "node_modules") -Filter "rg.exe" -Recurse -File |
    Where-Object { $_.FullName -match '@vscode[\\/]ripgrep[\\/]bin[\\/]rg\.exe$' } |
    Select-Object -First 1
if (-not $ripgrepPath) {
    throw "The Windows @vscode/ripgrep binary was not found."
}

$ripgrepPackageDirectory = Join-Path $releaseDirectory "node_modules\@vscode\ripgrep\bin"
New-Item -ItemType Directory -Path $ripgrepPackageDirectory -Force | Out-Null
Copy-Item -LiteralPath $ripgrepPath.FullName -Destination (Join-Path $ripgrepPackageDirectory "rg.exe") -Force
Copy-Item -LiteralPath $ripgrepPath.FullName -Destination (Join-Path $binDirectory "rg.exe") -Force

$wrapper = @'
@echo off
setlocal
set "ADTEC_CODE_CLI_ROOT=%~dp0.."
set "ADTEC_CODE_EXTENSION_PATH=%~dp0..\extension"
set "ADTEC_CODE_RIPGREP_PATH=%~dp0rg.exe"
node "%~dp0..\lib\index.js" %*
exit /b %ERRORLEVEL%
'@
Set-Content -LiteralPath (Join-Path $binDirectory "adtec-code.cmd") -Value $wrapper -Encoding Ascii

Compress-Archive -Path $releaseDirectory -DestinationPath $archivePath -CompressionLevel Optimal
Remove-Item -LiteralPath $releaseDirectory -Recurse -Force

$hash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath "$archivePath.sha256" -Value "$hash  $releaseName.zip" -Encoding Ascii
Write-Host "Created $archivePath"
