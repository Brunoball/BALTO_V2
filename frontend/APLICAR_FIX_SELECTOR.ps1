$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$envJs = Join-Path $root 'tests\support\env.js'
$selectorJs = Join-Path $root 'tests\support\env.selector.js'

if (-not (Test-Path $envJs)) {
  throw "No encontré tests\support\env.js. Extraé este ZIP directamente dentro de la carpeta frontend y volvé a ejecutar este archivo."
}

if (-not (Test-Path $selectorJs)) {
  throw "No encontré tests\support\env.selector.js. Volvé a extraer el ZIP completo."
}

$marker = "import './env.selector.js';"
$content = Get-Content -LiteralPath $envJs -Raw

if ($content -notmatch [regex]::Escape($marker)) {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $backup = "$envJs.bak-selector-$stamp"
  Copy-Item -LiteralPath $envJs -Destination $backup -Force

  $newContent = $marker + [Environment]::NewLine + $content
  [System.IO.File]::WriteAllText($envJs, $newContent, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host "[OK] tests/support/env.js conectado al selector."
  Write-Host "[OK] Backup: $backup"
} else {
  Write-Host "[OK] tests/support/env.js ya estaba conectado al selector."
}

$selectorEnv = Join-Path $root '.env.playwright.entorno'
if (-not (Test-Path $selectorEnv)) {
  @"
# Dejá UNA sola línea activa
#PW_ENTORNO=STOCK
PW_ENTORNO=SERVICIOS
#PW_ENTORNO=PRODUCCION
"@ | Set-Content -LiteralPath $selectorEnv -Encoding UTF8
  Write-Host "[OK] Creado .env.playwright.entorno con SERVICIOS activo."
}

Write-Host ""
Write-Host "LISTO. Desde ahora manda .env.playwright.entorno."
