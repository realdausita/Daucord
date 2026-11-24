# Daucord branding generator
# Compiles branding/make-icons.cs with the csc.exe bundled with Windows and
# regenerates the PNG size set + multi-size .ico from the master artwork.
# No downloads required.

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$source = if ($args.Length -ge 1) { $args[0] } else { "branding\source-logo.jpg" }
if (!(Test-Path $source)) { throw "Kaynak gorsel bulunamadi: $source" }

$csc = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (!(Test-Path $csc)) { $csc = Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe" }
if (!(Test-Path $csc)) { throw "csc.exe bulunamadi (Windows .NET Framework gerekli)." }

$exe = Join-Path $env:TEMP "daucord-make-icons.exe"

Write-Host "Ikon araci derleniyor..."
& $csc /nologo /optimize+ /target:exe /out:"$exe" /r:System.Drawing.dll "branding\make-icons.cs"
if ($LASTEXITCODE -ne 0) { throw "Derleme basarisiz." }

Write-Host "Ikonlar uretiliyor..."
& $exe $source "branding"
if ($LASTEXITCODE -ne 0) { throw "Ikon uretimi basarisiz." }
