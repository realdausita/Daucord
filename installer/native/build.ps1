# Daucord Installer build script
# Compiles DaucordInstaller.exe (GUI) and DaucordInstallerCli.exe (CLI)
# using the C# compiler that ships with Windows (.NET Framework).
# No downloads, no extra tooling.

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

$csc = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (!(Test-Path $csc)) { $csc = Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe" }
if (!(Test-Path $csc)) { throw "csc.exe bulunamadi (Windows .NET Framework gerekli)." }

if (!(Test-Path "dist\patcher.js")) { throw "dist\patcher.js yok. Once 'pnpm build' calistirin." }
if (!(Test-Path "branding\daucord.ico")) { throw "branding\daucord.ico yok." }

$out = "dist\Installer"
New-Item -ItemType Directory -Force $out | Out-Null

$files = @("patcher.js", "renderer.js", "renderer.css", "preload.js", "patcher.js.LEGAL.txt", "renderer.js.LEGAL.txt")
$res = @()
foreach ($f in $files) { $res += "/resource:dist\$f,Daucord.$f" }
$res += "/resource:branding\daucord-128.png,Daucord.logo.png"
$res += "/resource:branding\daucord-256.png,Daucord.logo256.png"
$res += "/resource:branding\daucord-card-bg.jpg,Daucord.hero.jpg"

$common = @(
    "/nologo",
    "/optimize+",
    "/platform:anycpu",
    "/win32icon:branding\daucord.ico",
    "/r:System.Windows.Forms.dll",
    "/r:System.Drawing.dll"
) + $res

Write-Host "GUI derleniyor: DaucordInstaller.exe"
& $csc @common /target:winexe /out:"$out\DaucordInstaller.exe" "installer\native\DaucordCore.cs" "installer\native\DaucordUi.cs" "installer\native\DaucordInstallerGui.cs"
if ($LASTEXITCODE -ne 0) { throw "GUI derlemesi basarisiz." }

Write-Host "CLI derleniyor: DaucordInstallerCli.exe"
& $csc @common /target:exe /out:"$out\DaucordInstallerCli.exe" "installer\native\DaucordCore.cs" "installer\native\DaucordInstallerCli.cs"
if ($LASTEXITCODE -ne 0) { throw "CLI derlemesi basarisiz." }

Write-Host ""
Get-ChildItem $out -Filter *.exe | ForEach-Object {
    Write-Host ("  {0,-28} {1,8:N1} KB" -f $_.Name, ($_.Length / 1KB))
}
Write-Host ""
Write-Host "Tamamlandi. Cikti: $out"
