# Plan de retoma — Sesión S3

**Creado:** 2026-09-18. Para retomar, abre Claude Code en esta carpeta y di:
*"Retoma S3 desde PLAN_RETOMA_S3.md"*. El agente busca la primera casilla sin marcar y sigue desde ahí.

S3 = **construir el flujo de citas y la red automatizada que dice "no"** (`GUIA_SESIONES_S2_S6.md` §S3).

## Cómo funcionan los puntos de control

Cada fase termina en un **🔖 PUNTO DE CONTROL**. Al llegar a uno, el agente:

1. deja las pruebas del repo tocado en verde (o anota aquí por qué no);
2. hace commit en `develop` de **cada** repo tocado;
3. marca las casillas de la fase en este archivo y hace commit de la raíz;
4. añade una entrada en `citas-api/docs/wiki/llm-wiki/wiki/log.md`.

Si hay que interrumpir, basta con llegar al último punto de control y subir:

```powershell
cd "C:\Users\IA ACADEMY 7\Desktop\Jhon\FCV_Proyecto_Citas_v1"
git push origin develop
git -C citas-api push origin develop
git -C citas-web push origin develop
```

Para retomar en **otro equipo**, sigue la sección "Retomar en otro equipo" de `PLAN_RETOMA_S2.md` y luego abre este archivo.

## Alcance: HU de S3 (aprobación delegada del 2026-09-18)

El usuario pidió continuar S3 dejando el diseño "a criterio del agente". Se registra como
**aprobación delegada** (`AGENTS.md` §6) de estas HU; el usuario puede devolver cualquiera a
`Pendiente de aprobación`.

| Bloque | HU |
|---|---|
| Autorización y contrato | HU-005 (rol y ownership), HU-033 (contrato REST, vivo) |
| Catálogos | HU-010 (catálogos fijos), HU-011 (especialidades y duración) |
| Profesionales (admin) | HU-013 crear · HU-014 especialidades/primaria · HU-015 sedes · HU-016 activar/desactivar |
| Agenda (profesional) | HU-017 bloques y slots · HU-018 editar/eliminar bloques futuros · HU-019 calendario |
| Reserva (usuario) | HU-022 buscar disponibilidad · HU-023 cita general · HU-024 cita especializada (**GOAL_02**) · HU-025 mis citas |
| Aprobación (admin) | HU-029 bandeja · HU-030 aprobar/rechazar especializada |
| Auditoría | HU-032 historial de estados |

**Fuera de S3** (quedan para S4): HU-006/007 recuperación de contraseña, HU-008/009 perfil y afiliación,
HU-012 EPS/planes, HU-020/021 agenda del profesional y cierre, HU-026/027/028/031 cancelación y reprogramación.

## Decisiones tomadas bajo aprobación delegada (confirmar)

Detalle y alternativas en la wiki: `dec-004-decisiones-s3-reserva.md`.

| # | Pregunta abierta | Decisión |
|---|---|---|
| D5 | A3 · ¿Cómo nace el primer ADMIN? | Arranque: si no existe ningún ADMIN y hay `ADMIN_BOOTSTRAP_EMAIL` + `ADMIN_BOOTSTRAP_PASSWORD` en el entorno, se crea. Sin credenciales en el repo |
| D6 | INC-013 · Contraseña inicial del profesional | La fija el ADMIN en el formulario de alta (hash BCrypt) |
| D7 | S3 / INC-009 · ¿Medicina General se precarga? | Sí, por migración (`MEDICINA_GENERAL`, tipo GENERAL, 30 min). No se puede desactivar |
| D8 | E1 / E2 · Defectos de auditoría | V5: el historial deja de borrarse en cascada y se añade el origen `PROFESSIONAL` |
| D9 | N2 · ¿Una cita de 60 min puede cruzar dos bloques? | No: los dos slots son consecutivos **dentro del mismo bloque** |
| D10 | INC-024 · ¿Caduca la retención de una REQUESTED? | No caduca en S3; se libera al rechazar |
| D11 | INC-014 / N5 · Profesional desactivado | Sigue pudiendo iniciar sesión; deja de ofrecerse en búsquedas y no admite reservas nuevas. Las citas existentes se conservan |
| D12 | INC-032 · Aprobar una REQUESTED ya vencida | Se rechaza con 409; el ADMIN debe rechazarla con motivo |
| D13 | Hooks | Git hooks versionados en `.githooks/` de cada repo (`core.hooksPath`), no dependen de Claude Code |

## Base verificada al empezar

- [x] Backend `mvn test` en verde sobre `develop`: **104/104** (2026-09-18)
- [x] Frontend `npm test` **42/42**, `npm run build` y `npm run lint` en verde (2026-09-18)
- [ ] (Pendiente de S2, lo hace el usuario) Prueba manual E2E de registro/login/logout en navegador

---

## F0 — Preparación y especificación

- [x] HU del alcance pasadas a `Aprobada` (aprobación delegada) con línea en su historial
- [x] Wiki: `dec-004-decisiones-s3-reserva.md`, síntesis actualizada (D5–D13), índice apuntando a S3 y a `Jhonstewar`
- [x] Este plan versionado en la raíz

🔖 **PUNTO DE CONTROL F0** — commits: raíz (`docs(s3): plan de retoma y alcance`), citas-api (`docs(s3): aprobar HU de S3 y decisiones`)

## F1 — La red que dice "no" (hooks locales) · verificación 8, 9, 10

Se construye **primero**, para que todo lo que sigue ya pase por ella.

- [x] `.githooks/secret-scan.mjs` (Node, sin dependencias): patrones de claves privadas, JWT, `AKIA…`, `ghp_…`, `password=`/`secret=` con valor literal, `.env` staged. Lista blanca para `.env.example` y el secreto ficticio de `application-test.yml`
- [x] `citas-api/.githooks/pre-commit`: escaneo de secretos + `mvn -B test` en Docker (si Docker no está, falla con mensaje claro)
- [x] `citas-web/.githooks/pre-commit`: escaneo de secretos + `typecheck` + `lint` + `test`
- [x] Raíz `.githooks/pre-commit`: escaneo de secretos
- [x] `scripts/install-hooks.ps1`: configura `core.hooksPath` en los tres repos
- [x] **Evidencia FAIL (secreto):** commit con secreto ficticio → bloqueado. Salida guardada en `EVIDENCIAS_S3.md`
- [x] **Evidencia FAIL (prueba roja):** commit con una prueba rota → bloqueado. Salida guardada
- [x] **Evidencia PASS:** se corrige y el commit pasa. Hash del commit permitido en `EVIDENCIAS_S3.md`

🔖 **PUNTO DE CONTROL F1** — commits: `chore(s3): hooks locales de secretos y pruebas` en los tres repos

## F2 — Backend: autorización, catálogos, V5 · HU-005, HU-010, HU-011, HU-032(esquema)

TDD: cada caso de uso empieza con su prueba en rojo.

- [ ] **Demostración Red → Green** (verificación 2 y 3): primera prueba escrita antes del código, ejecutada en rojo, salida guardada en `EVIDENCIAS_S3.md`; luego verde
- [ ] V5: historial sin `ON DELETE CASCADE`, origen `PROFESSIONAL` (D8)
- [ ] V6: semilla `MEDICINA_GENERAL` (D7)
- [ ] Autorización por rol: `/api/admin/**` → ADMIN, `/api/professional/**` → PROFESSIONAL, `/api/patient/**` → USER; denegación por defecto; 401 ≠ 403 (HU-005)
- [ ] Bootstrap del primer ADMIN (D5) + variables en `.env.example` y `docker-compose.yml`
- [ ] `GET /api/catalogs/{sites,appointment-types,appointment-statuses,document-types}` (HU-010)
- [ ] CRUD de especialidades con duración 30/60, activar/desactivar, sin borrado físico si está referenciada (HU-011)
- [ ] Pruebas de autorización básicas (verificación 6): anónimo → 401, rol equivocado → 403, rol correcto → 2xx

🔖 **PUNTO DE CONTROL F2** — commit citas-api: `feat(s3): autorización por rol, catálogos y especialidades`

## F3 — Backend: profesionales · HU-013, HU-014, HU-015, HU-016

- [ ] Alta atómica usuario + profesional con rol PROFESSIONAL (D6); duplicados → 409
- [ ] Asignar especialidades con una sola primaria; asignar sedes
- [ ] Activar/desactivar (D11); listado y detalle para ADMIN

🔖 **PUNTO DE CONTROL F3** — commit citas-api: `feat(s3): gestión de profesionales`

## F4 — Backend: agenda del profesional · HU-017, HU-018, HU-019

- [ ] Crear bloque → slots de 30 min; sin pasado, sin solape, solo sedes asignadas, solo para sí mismo
- [ ] Editar/eliminar bloques futuros sin reservas
- [ ] Calendario del profesional por rango de fechas
- [ ] **Pruebas de reglas de slots 30/60** (verificación 4): bloque 08:00–12:00 → 8 slots; bordes de la rejilla; 60 min exige 2 consecutivos del mismo bloque

🔖 **PUNTO DE CONTROL F4** — commit citas-api: `feat(s3): bloques de disponibilidad y slots`

## F5 — Backend: reserva · HU-032, HU-022, HU-023, HU-024 (GOAL_02), HU-025

- [ ] Modelo de dominio `Appointment` con transiciones explícitas (RN-11) y el historial en la misma transacción (HU-032)
- [ ] Búsqueda de franjas: filtros sede, tipo, especialidad, profesional, fecha; 30 → 1 slot, 60 → 2 consecutivos; excluye retenidos y pasado
- [ ] Cita general → `APPROVED` automáticamente, origen SYSTEM
- [ ] Cita especializada → `REQUESTED`, slots retenidos, origen USER
- [ ] **Prueba de doble reserva** (verificación 5): segunda reserva → 409; **concurrente** con dos hilos → exactamente una gana (lo garantiza la PK de `slot_reservations`)
- [ ] Mis citas con filtros estado/fecha y detalle con motivo de rechazo (ownership: nunca las de otro)

🔖 **PUNTO DE CONTROL F5** — commit citas-api: `feat(s3): reserva de citas general y especializada`

## F6 — Backend: operación del ADMIN · HU-029, HU-030

- [ ] Bandeja: `REQUESTED` con filtros sede, profesional, especialidad, fecha
- [ ] Aprobar → `APPROVED`; rechazar con motivo obligatorio → `REJECTED` y libera slots; transiciones inválidas → 409; vencida → 409 (D12)
- [ ] Decisiones concurrentes sobre la misma cita: una gana (bloqueo optimista o `SELECT … FOR UPDATE`)
- [ ] Contrato REST documentado: `wiki/contrato-rest-citas.md` (HU-033)

🔖 **PUNTO DE CONTROL F6** — commit citas-api: `feat(s3): bandeja y decisión administrativa`

## F7 — Frontend: base visual y navegación por rol

Diseño propio (no hubo Stitch): limpio, clínico, en español, accesible.

- [ ] Sistema visual ampliado en `tokens.css`: paleta, tipografía, espaciado, estados, modo oscuro
- [ ] Layout con barra lateral según rol (USER / PROFESSIONAL / ADMIN) y cabecera con usuario y salir
- [ ] Rutas protegidas por rol; 401 → login, 403 → pantalla "sin permiso" (HU-005 CA-08, CA-09)
- [ ] Componentes: tarjeta, tabla, insignia de estado, modal de confirmación, estado vacío, esqueleto de carga, toast
- [ ] `contracts.ts` ampliado con todos los endpoints de S3

🔖 **PUNTO DE CONTROL F7** — commit citas-web: `feat(s3): navegación por rol y sistema visual`

## F8 — Frontend: paciente

- [ ] Inicio del paciente: próximas citas y acceso rápido a "Agendar"
- [ ] Agendar en pasos: tipo → especialidad → sede → profesional → fecha → franja → confirmar
- [ ] Mis citas con filtros y detalle (motivo de rechazo visible)
- [ ] Errores 409 (franja tomada) explicados y con reintento

🔖 **PUNTO DE CONTROL F8** — commit citas-web: `feat(s3): reserva de citas del paciente`

## F9 — Frontend: profesional

- [ ] Calendario semanal de bloques con slots libres/ocupados
- [ ] Crear, editar y eliminar bloques con validación y errores del backend

🔖 **PUNTO DE CONTROL F9** — commit citas-web: `feat(s3): agenda del profesional`

## F10 — Frontend: administrador

- [ ] Panel con contadores (solicitudes pendientes, profesionales activos)
- [ ] Bandeja: aprobar / rechazar con motivo en modal
- [ ] CRUD de profesionales (especialidades, primaria, sedes, activo)
- [ ] CRUD de especialidades (duración 30/60, tipo, activa)

🔖 **PUNTO DE CONTROL F10** — commit citas-web: `feat(s3): operación administrativa`

## F11 — Verificación y cierre de S3

- [ ] Verificación independiente backend (`backend-verifier`) y frontend (`frontend-verifier`) HU por HU
- [ ] Frontend: `typecheck`, `lint`, `test`, `build` en verde (verificación 7)
- [ ] Guía de prueba manual S3 (flujo completo con los tres roles) en `EVIDENCIAS_S3.md`
- [ ] HU cerradas a `Completada` solo con matriz de evidencia completa
- [ ] Wiki: LINT, índice, log; esta lista completa
- [ ] Commit de cierre: `test(s3): implement booking flow and automated quality gates` en ambos repos

🔖 **PUNTO DE CONTROL F11** — push de `develop` de los tres repos (con confirmación del usuario)

## Registro de avance

Una línea por punto de control alcanzado (fecha · fase · commits).

- 2026-09-18 · plan creado
- 2026-09-18 · 🔖 F0 · raíz + citas-api (`docs(s3): …`)
- 2026-09-18 · 🔖 F1 · raíz `996b33f`… · citas-api `4d4cb89`, `a97fd6a`, `062725b` · citas-web `df252ef`, `dd73877` · evidencia en `EVIDENCIAS_S3.md`
