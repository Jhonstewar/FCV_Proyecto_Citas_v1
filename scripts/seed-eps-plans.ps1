# Siembra el catalogo de EPS y planes de afiliacion del laboratorio.
#
# Por que un script y no una migracion Flyway: `V4__seed_fixed_catalogs.sql` siembra solo los
# catalogos FIJOS (sedes, roles, estados, tipos de documento, regimenes) y dice explicitamente
# que los configurables no se siembran, porque en el diseno los administra el ADMIN en HU-012.
# Mientras HU-012 siga fuera de alcance, el laboratorio necesita datos para que el desplegable
# de afiliacion del registro tenga algo que mostrar. Esto lo resuelve sin contradecir V4 ni
# comprometer el esquema con datos de ejemplo.
#
# TODAS las EPS y los planes son FICTICIOS. El PRD solo admite como informacion real las sedes
# HIC e ICV; cualquier otro dato del dominio es sintetico.
#
# Es idempotente: se apoya en las claves unicas `eps.code` y `uq_eps_plans_eps_code`, asi que
# se puede ejecutar las veces que haga falta sin duplicar nada.
#
# Uso:  .\scripts\seed-eps-plans.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path ".env")) { throw "Falta .env (copia .env.example)" }
$envMap = @{}
Get-Content .env | Where-Object { $_ -match '^[A-Za-z_][A-Za-z0-9_]*=' } | ForEach-Object {
  $k, $v = $_.Split('=', 2); $envMap[$k] = $v
}

$db = $envMap['MYSQL_DATABASE']
$rootPassword = $envMap['MYSQL_ROOT_PASSWORD']

# El id del contenedor sale de compose y no de un nombre fijo: depende del proyecto.
$mysqlId = docker compose ps -q mysql
if (-not $mysqlId) { throw "MySQL no esta levantado: docker compose up -d mysql" }

$sql = @'
START TRANSACTION;

INSERT INTO eps (code, name, active) VALUES
  ('EPS_BIENESTAR', 'Bienestar Andino EPS', 1),
  ('EPS_ORIENTE',   'Salud Integral del Oriente', 1),
  ('EPS_MERIDIANO', 'Meridiano Salud', 1),
  ('EPS_ANTIGUA',   'Prevision Antigua EPS', 0)
ON DUPLICATE KEY UPDATE name = VALUES(name), active = VALUES(active);

-- Los planes referencian la EPS por codigo y el regimen por codigo: nada de ids a mano.
INSERT INTO eps_plans (eps_id, regime_id, code, name, active)
SELECT e.id, r.id, p.code, p.name, p.active
FROM (
  SELECT 'EPS_BIENESTAR' AS eps, 'CONTRIBUTIVO' AS regime, 'BIEN_CONTRIB'  AS code, 'Plan Contributivo Basico'   AS name, 1 AS active
  UNION ALL SELECT 'EPS_BIENESTAR', 'CONTRIBUTIVO', 'BIEN_PLUS',    'Plan Contributivo Plus',      1
  UNION ALL SELECT 'EPS_BIENESTAR', 'SUBSIDIADO',   'BIEN_SUBS',    'Plan Subsidiado',             1
  UNION ALL SELECT 'EPS_ORIENTE',   'CONTRIBUTIVO', 'ORI_CONTRIB',  'Plan Contributivo Oriente',   1
  UNION ALL SELECT 'EPS_ORIENTE',   'SUBSIDIADO',   'ORI_SUBS',     'Plan Subsidiado Oriente',     1
  UNION ALL SELECT 'EPS_MERIDIANO', 'CONTRIBUTIVO', 'MER_CONTRIB',  'Plan Contributivo Meridiano', 1
  UNION ALL SELECT 'EPS_MERIDIANO', 'ESPECIAL',     'MER_ESPECIAL', 'Plan Regimen Especial',       1
  -- Plan inactivo a proposito: el catalogo publico no debe ofrecerlo.
  UNION ALL SELECT 'EPS_MERIDIANO', 'CONTRIBUTIVO', 'MER_RETIRADO', 'Plan Meridiano (retirado)',   0
  -- Plan activo de una EPS inactiva: tampoco debe ofrecerse.
  UNION ALL SELECT 'EPS_ANTIGUA',   'CONTRIBUTIVO', 'ANT_CONTRIB',  'Plan Antigua Contributivo',   1
) AS p
JOIN eps e ON e.code = p.eps
JOIN regimes r ON r.code = p.regime
ON DUPLICATE KEY UPDATE name = VALUES(name), active = VALUES(active), regime_id = VALUES(regime_id);

COMMIT;

SELECT e.name AS eps, e.active AS eps_activa, pl.name AS plan, r.code AS regimen, pl.active AS plan_activo
FROM eps_plans pl JOIN eps e ON e.id = pl.eps_id JOIN regimes r ON r.id = pl.regime_id
ORDER BY e.name, pl.name;
'@

# La clave viaja en MYSQL_PWD y no en `-p<clave>`: no queda en la linea de comandos del contenedor.
$sql | docker compose exec -T -e MYSQL_PWD=$rootPassword mysql mysql -uroot $db
if ($LASTEXITCODE -ne 0) { throw "No se pudo sembrar el catalogo de EPS y planes" }

Write-Host "[OK] Catalogo de EPS y planes sembrado (datos ficticios)." -ForegroundColor Green
