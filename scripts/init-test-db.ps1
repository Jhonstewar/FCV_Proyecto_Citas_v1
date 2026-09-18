# Crea la base de datos de PRUEBAS, separada de la de desarrollo.
#
# Motivo: hasta S2 las pruebas de integracion escribian en `citas_fcv_training`, la misma base
# que usa el backend al ejecutarse. Un fallo a mitad de una prueba dejaba residuos en la base de
# trabajo y la verificacion de CA-08 (migraciones sobre base vacia) era imposible.
#
# Concede ademas privilegios al usuario de la aplicacion sobre el patron `citas_fcv_%`, para que
# las pruebas puedan crear y destruir su propio esquema desechable de verificacion de migraciones.
#
# Uso:  .\scripts\init-test-db.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path ".env")) { throw "Falta .env (copia .env.example)" }
$envMap = @{}
Get-Content .env | Where-Object { $_ -match '^[A-Za-z_][A-Za-z0-9_]*=' } | ForEach-Object {
  $k, $v = $_.Split('=', 2); $envMap[$k] = $v
}

$db = $envMap['MYSQL_DATABASE']
$user = $envMap['MYSQL_USER']
$rootPassword = $envMap['MYSQL_ROOT_PASSWORD']
$testDb = "${db}_test"

# Se consulta el healthcheck del contenedor en vez de invocar mysqladmin: en Windows
# PowerShell 5.1, redirigir el stderr de un ejecutable nativo lo convierte en error de
# terminacion y aborta el script aunque el comando haya salido con codigo 0.
Write-Host "Esperando MySQL..." -ForegroundColor Cyan
$healthy = $false
for ($i = 0; $i -lt 30; $i++) {
  $status = docker inspect --format '{{.State.Health.Status}}' fcv-citas-mysql
  if ($status -eq 'healthy') { $healthy = $true; break }
  Start-Sleep -Seconds 2
}
if (-not $healthy) { throw "MySQL no llego a estado healthy" }

# El patron `citas\_fcv\_%` cubre la base de desarrollo, la de pruebas y el esquema desechable
# que crea FlywayMigratesEmptySchemaTest. Los `\_` escapan el guion bajo para que no actue como
# comodin de un caracter.
$sqlTemplate = @'
CREATE DATABASE IF NOT EXISTS `__TESTDB__` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
GRANT ALL PRIVILEGES ON `citas\_fcv\_%`.* TO '__USER__'@'%';
FLUSH PRIVILEGES;
SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'citas\_fcv\_%';
'@
$sql = $sqlTemplate.Replace('__TESTDB__', $testDb).Replace('__USER__', $user)

# La clave viaja en MYSQL_PWD y no en `-p<clave>`: asi no queda en la linea de comandos del
# contenedor ni provoca el aviso de mysql. PowerShell 5.1 ademas no pasa correctamente el
# argumento pegado `-p$var` cuando la clave termina en un caracter especial.
$sql | docker compose exec -T -e MYSQL_PWD=$rootPassword mysql mysql -uroot
if ($LASTEXITCODE -ne 0) { throw "No se pudo preparar la base de pruebas" }

Write-Host "[OK] Base de pruebas '$testDb' lista y privilegios concedidos a '$user'." -ForegroundColor Green
