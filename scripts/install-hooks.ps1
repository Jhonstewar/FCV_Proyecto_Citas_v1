# Activa los hooks versionados de los tres repos (S3, decision D13).
#
# Cada repo guarda sus hooks en `.githooks/` y Git los usa gracias a `core.hooksPath`, que es
# configuracion LOCAL: hay que ejecutar este script una vez por equipo y por clon.
#
#   raiz       -> escaneo de secretos
#   citas-api  -> escaneo de secretos + mvn test en Docker
#   citas-web  -> escaneo de secretos + typecheck + lint + vitest
#
# Uso:  .\scripts\install-hooks.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

foreach ($repo in @($Root, (Join-Path $Root "citas-api"), (Join-Path $Root "citas-web"))) {
  if (-not (Test-Path (Join-Path $repo ".githooks\pre-commit"))) {
    Write-Host "Omitido (sin .githooks/pre-commit): $repo" -ForegroundColor Yellow
    continue
  }
  git -C $repo config core.hooksPath .githooks
  Write-Host "Hooks activos en $repo" -ForegroundColor Green
}
Write-Host "Requisitos: Node 24 en el PATH y, para citas-api, Docker Desktop con MySQL levantado."
