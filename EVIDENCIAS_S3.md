# Evidencias S3 — La red que dice "no"

Evidencia de la verificación obligatoria de S3 (`GUIA_SESIONES_S2_S6.md` §S3). Cada salida se
copió de la terminal en el momento de la prueba. Plan y avance: `PLAN_RETOMA_S3.md`.

## 1. Hooks locales (verificación 8)

Hooks `pre-commit` versionados en `.githooks/` de cada repo y activados con
`.\scripts\install-hooks.ps1`, que configura `core.hooksPath` (decisión D13).

| Repo | Qué comprueba | Cuándo |
|---|---|---|
| raíz | escaneo de secretos | siempre |
| `citas-api` | escaneo de secretos + `mvn -B test` en Docker (104 pruebas al empezar S3) | pruebas solo si el commit toca algo más que `docs/` o `*.md` |
| `citas-web` | escaneo de secretos + `typecheck` + `lint` + `vitest` | ídem |

El escáner (`.githooks/secret-scan.mjs`, Node sin dependencias) revisa solo las **líneas
agregadas** del commit, y aplica tres grupos de reglas:

- **Archivos prohibidos:** `.env*` salvo `.env.example`, `*.pem`/`*.p12`/`*.jks`, claves SSH.
- **Alta confianza, en cualquier archivo:** clave privada PEM, AWS, GitHub, Google, Slack, Stripe, JWT firmado, URL con usuario y contraseña.
- **Credencial asignada a un literal:** `password`, `secret`, `api-key`, `token`… en configuración y código. No se aplica a pruebas, `docs/` ni `*.example`, e ignora `${VAR}`, `CHANGE_ME`, `test-only`, textos con espacios y rutas.

Auditoría de todo lo versionado (`node .githooks/secret-scan.mjs --all`) en los tres repos al
instalar la red: **sin hallazgos**. Tras la auditoría se ajustó la regla de código, que marcaba
4 falsos positivos en mensajes de UI y rutas de `citas-web`.

Prueba del escáner contra un repo desechable con valores ficticios: bloqueó los 6 que debía
(`.env`, contraseña en YAML, API key en TS, token de GitHub, URL con credenciales) y dejó pasar
`${DB_USER}`, `CHANGE_ME_KEY`, `.env.example`, la contraseña de un `*.test.ts`, el texto
"Repite la contraseña." y la ruta `/api/auth/refresh`.

## 2. Secreto ficticio bloqueado (verificación 9)

Se simuló el error típico al preparar el primer ADMIN (decisión D5): la contraseña escrita como
literal en `citas-api/src/main/resources/application.yml`.

```text
$ git commit -m "feat(s3): primer ADMIN"
[pre-commit] citas-api: 1/2 escaneo de secretos

[secret-scan] COMMIT BLOQUEADO: posibles secretos en el cambio.

  src/main/resources/application.yml:83  credencial en configuracion  -> Admi…6! (13 caracteres)

Que hacer:
  1. Quita el valor del archivo y leelo de una variable de entorno (.env, que no se versiona).
  2. Si ya estaba en un commit anterior, considera el secreto comprometido y rotalo.
  3. Si es un valor ficticio documentado, termina la linea con "secret-scan:allow" y el motivo.
```

El valor se enmascara en la salida para que el propio hook no lo filtre a la terminal ni a un log.

## 3. Corrección y commit permitido (verificación 10)

El valor pasa a leerse del entorno (`${ADMIN_BOOTSTRAP_PASSWORD:}`, vacío por defecto) y se
documenta en `.env.example` sin valor.

```text
[pre-commit] citas-api: 1/2 escaneo de secretos
[secret-scan] OK: ningun secreto en las lineas agregadas.
[pre-commit] citas-api: 2/2 pruebas (mvn -B test en Docker)...
[pre-commit] citas-api: pruebas en verde
[develop 062725b] chore(s3): credenciales del primer ADMIN solo por variables de entorno
 2 files changed, 10 insertions(+)
```

**Commit permitido: `citas-api@062725b`.**

El primer intento de ese mismo commit lo bloqueó una prueba en rojo **ajena al cambio**:
`FlywayMigratesEmptySchemaTest` no pudo leer `V1__identity_and_fixed_catalogs.sql` del
classpath. La prueba pasó sola dos veces seguidas y la suite completa pasó en el reintento. Queda
registrada como prueba intermitente en la wiki (`riesgo-prueba-intermitente-flyway.md`); la red
hizo lo correcto: con una prueba roja no se commitea.

## 4. Prueba roja bloqueada (verificación 8, caso FAIL)

Se cambió a propósito el valor esperado de una prueba de `citas-web`:

```text
$ git commit -m "test: cambiar URL esperada"
[pre-commit] citas-web: 1/2 escaneo de secretos
[secret-scan] OK: ningun secreto en las lineas agregadas.
[pre-commit] citas-web: typecheck
[pre-commit] citas-web: lint
[pre-commit] citas-web: test

[pre-commit] COMMIT BLOQUEADO: falla 'npm run test'. Ultimas lineas:

 FAIL  src/api/contracts.test.ts > API_BASE_URL > toma VITE_API_URL y le quita la barra final
AssertionError: expected 'http://api.test' to be 'http://localhost:9999' // Object.is equality

 Test Files  1 failed | 4 passed (5)
      Tests  1 failed | 41 passed (42)
```

El cambio se revirtió (`git checkout`); no llegó a ningún commit.

## 5. Commits que pasaron la red (caso PASS)

| Repo | Commit | Qué validó el hook |
|---|---|---|
| raíz | `996b33f` | secretos |
| `citas-api` | `4d4cb89`, `a97fd6a`, `062725b` | secretos + 104 pruebas |
| `citas-web` | `df252ef`, `dd73877` | secretos + typecheck + lint + 42 pruebas |

## 6. Red → Green (verificaciones 1, 2 y 3)

**Prueba escrita antes del código:** `citas-api/src/test/java/com/fcv/citas/infrastructure/rest/AuthorizationIntegrationTest.java`
(HU-005 y HU-010). Se ejecutó cuando aún no existían las reglas por rol ni los controladores de S3.

**RED** (`mvn test -Dtest=AuthorizationIntegrationTest`, antes de implementar):

```text
[ERROR] Tests run: 10, Failures: 9, Errors: 0, Skipped: 0 <<< FAILURE! -- in ...AuthorizationIntegrationTest
[ERROR] ...fixedCatalogsRejectWrites -- java.lang.AssertionError: Status expected:<405> but was:<404>
[ERROR] ...onlyProfessionalReachesProfessionalRoutes -- java.lang.AssertionError: Status expected:<403> but was:<404>
[ERROR] ...undeclaredRoutesAreDeniedEvenWhenAuthenticated -- java.lang.AssertionError: Status expected:<403> but was:<404>
[ERROR] ...anyAuthenticatedRoleReadsCatalogs(String)[1] -- java.lang.AssertionError: Status expected:<200> but was:<404>
[ERROR] ...onlyAdminReachesAdminRoutes -- ...
```

Falla por la razón correcta: toda ruta autenticada caía en `anyRequest().authenticated()` y
respondía 404 porque no había reglas por rol ni rutas. La única que pasaba
(`catalogsRequireAuthentication`) ya estaba cubierta por la seguridad de S2.

**Implementación mínima:** reglas por prefijo y `denyAll` por defecto en `SecurityConfig`,
`CatalogController`, `AdminSpecialtyController` y `PatientAppointmentController`.

**GREEN** (suite completa, mismo día):

```text
[INFO] Tests run: 10, Failures: 0, Errors: 0 -- in ...AuthorizationIntegrationTest
[INFO] Tests run: 10, Failures: 0, Errors: 0 -- in ...SpecialtyAdminIntegrationTest
[INFO] Tests run: 6,  Failures: 0, Errors: 0 -- in ...FlywayMigratesEmptySchemaTest
[INFO] Tests run: 4,  Failures: 0, Errors: 0 -- in com.fcv.citas.HexagonalArchitectureTest
[INFO] Tests run: 126, Failures: 0, Errors: 0, Skipped: 0
```

## 7. Pruebas de slots 30/60, doble reserva y autorización (verificaciones 4, 5 y 6)

**Autorización (verificación 6), F2:** `AuthorizationIntegrationTest`: anónimo → 401; rol
equivocado → 403 con `title: "Acceso denegado"`; rol correcto → 200; ruta no declarada con ADMIN
→ 403 (denegación por defecto); catálogos para los tres roles; escritura sobre catálogos fijos → 405.

**Slots 30/60 (verificación 4), F4:** `AvailabilityBlockTest` (dominio): 08:00–12:00 → 8 slots exactos; 14:00–17:00 → 6; horas fuera de la rejilla :00/:30 rechazadas; 60 min exige el slot siguiente dentro del mismo bloque (09:30 en un bloque que acaba a las 10:00 no aloja 60 min). `ScheduleIntegrationTest`: los 8 slots persisten con las mismas horas locales (lectura SQL cruda).

_Doble reserva: pendiente de F5._
