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

**Doble reserva (verificación 5), F5:** `BookingIntegrationTest`:

- `doubleBookingIsRejectedWith409`: el mismo slot reservado dos veces → 409 `SLOT_TAKEN`; no queda una segunda cita ni una segunda fila de historial.
- `concurrentBookingsOfTheSameSlotLetExactlyOneWin`: **8 hilos** confirman a la vez el mismo slot → exactamente **1 × 201 y 7 × 409**, una sola cita y una sola fila en `slot_reservations`. Se repitió 3 veces más de forma aislada, todas en verde.
- `sixtyMinutesWithTakenSecondSlotRetainsNothing`: si el segundo slot de una cita de 60 min está tomado, el primero **no** queda retenido (la transacción se deshace entera).

El caso de uso no comprueba antes si el slot está libre: la única barrera es la clave primaria `slot_id` de `slot_reservations` (dec-003). Por eso la prueba concurrente mide esa garantía y no una comprobación que una carrera podría saltarse.

### Prueba de mutación de la doble reserva

Se cambió `SlotReservationJpaEntity.isNew()` para devolver `false` (Spring Data hace `merge` en vez de `persist`) y se ejecutaron las dos pruebas de doble reserva:

```text
[ERROR] BookingIntegrationTest.doubleBookingIsRejectedWith409:153 Status expected:<409> but was:<201>
[ERROR] Tests run: 2, Failures: 1, Errors: 0, Skipped: 0
```

- **Mutante eliminado** por `doubleBookingIsRejectedWith409`: con `merge`, la segunda reserva **sobrescribe** la fila ajena de `slot_reservations` y responde 201. Es una doble reserva real que la PK no impide, porque no hay INSERT.
- La prueba concurrente **no** lo detecta: bajo carrera, `merge` termina en un INSERT duplicado que sí choca con la PK. Las dos pruebas son necesarias; cada una cubre un modo de fallo distinto.
- El cambio se revirtió (`git diff` vacío) antes de seguir.

## 8. Prueba de humo de extremo a extremo contra el backend real (contrato entre repos)

`scripts/e2e-smoke.mjs` recorre el flujo de S3 por HTTP con los tres roles contra `citas-api`
levantado con `spring-boot:run`, incluido el preflight CORS desde `http://localhost:5173`. Crea
sus propios datos con una etiqueta aleatoria y no imprime contraseñas ni tokens.

```text
E2E S3 contra http://localhost:8081 (etiqueta 016bd6)
0. Salud y CORS            ✔ health UP · ✔ preflight CORS desde http://localhost:5173
1. ADMIN                   ✔ login del ADMIN inicial (D5) · ✔ HIC e ICV · ✔ Medicina General protegida
                           ✔ especialidad 60 min · ✔ 45 min → 400 · ✔ 2 profesionales creados
2. PROFESSIONAL            ✔ 08:00–12:00 → 8 slots · ✔ solape → 409 BLOCK_OVERLAP · ✔ bloque 14:00–17:00
3. USER                    ✔ registro · ✔ 8 franjas de 30 min · ✔ general → APPROVED · ✔ repetida → 409 SLOT_TAKEN
                           ✔ 60 min: 5 franjas, nunca 16:30 · ✔ flujo equivocado → 422 WRONG_FLOW
                           ✔ especializada → REQUESTED (GOAL_02) · ✔ USER en ruta ADMIN → 403
4. ADMIN decide            ✔ bandeja con 2 · ✔ aprobar · ✔ rechazar sin motivo → 400 · ✔ rechazar con motivo
                           ✔ la franja rechazada vuelve a ofrecerse (RN-09)
5. Consulta                ✔ mis citas: 3 · ✔ detalle con motivo e historial · ✔ agenda con 2 slots ocupados
Resultado: 29 OK, 0 con fallo.
```

El frontend (`citas-web`, 74 pruebas con `fetch` simulado) usa las mismas rutas: se contrastó
`src/api/contracts.ts` con los `@*Mapping` del backend y coinciden todas. La única ausente del
backend es `/api/auth/password-recovery` (RF-03, HU-006), que queda para S4. **No verificado:**
la navegación real en el navegador (prueba manual con los tres roles, sección 9).
