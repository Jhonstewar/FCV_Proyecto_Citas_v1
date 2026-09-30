# PLAN S5–S6 — Automatizaciones n8n (WF-001, WF-002, WF-003)

**Estado:** borrador para aprobación · **decididas D-A, D-B, D-H (2026-09-30)** · **Fecha:** 2026-09-30 · **Base:** `develop` tras el cierre de F8/LOOP_03 de S4.
**Fuentes leídas:** `GUIA_SESIONES_S2_S6.md` (S5, S6), `PRD.md` §4, §5, §8, §10, `RESTRICCIONES_TECNICAS.md` (n8n),
`contrato-rest-citas.md`, `contrato-rest-identidad.md`, `SecurityConfig.java`, casos de uso de `application/appointment/`,
`docker-compose.yml`, `.env.example` y el estado real de la instancia n8n consultada por MCP.

> **Para ejecutar:** el orden exacto, los agentes, las comprobaciones y las reglas de parada están en [`PLAN_EJECUCION_S5_S6.md`](PLAN_EJECUCION_S5_S6.md). Este documento conserva el diagnóstico, los contratos y los riesgos.

---

## 0. Diagnóstico: qué hay y qué falta

### 0.1 Lo que pide el curso

| Flujo | Sesión | Obligatoriedad | Cadena |
|---|---|---|---|
| **WF-001** recordatorios | S5 | Obligatorio | `Schedule → API citas APPROVED próximas → Gmail → registro` |
| **WF-002** cambio de estado | S6 | Obligatorio | `Webhook desde Spring → n8n → Gmail → registro` |
| **WF-003** resumen diario | S6 | **Bonus** | `Schedule → API resumen del día → agrupar sede/estado → Gmail` |

Evidencia S5: workflow funcionando, invocación MCP exitosa desde el agente, credenciales de privilegio mínimo,
JSON en `citas-api/automations/n8n/WF-001-appointment-reminders.json`, riesgos residuales por escrito, commit S5.
Evidencia S6: WF-001 y WF-002 versionados, agente que lista/inspecciona/crea/actualiza/valida por MCP con
ejecución controlada, commit S6. **No se activa un flujo sin validar su salida.**

### 0.2 Estado real del backend (verificado en código)

- **No existe nada de n8n**: ni `automations/n8n/`, ni webhooks, ni clientes HTTP salientes, ni puerto de eventos.
  La única "notificación" es `PasswordResetNotifier`, que solo escribe un log.
- **Todos los endpoints exigen un JWT de persona con rol** (`SecurityConfig.java:83-85`: `/api/admin/**`,
  `/api/professional/**`, `/api/patient/**`) y lo no declarado es `denyAll` (`:94`). **n8n no tiene ninguna forma
  legítima de leer citas hoy.**
- El único dato agregado es `GET /api/admin/summary`: cuatro contadores sin desglose por sede/estado. No sirve para WF-003.
- Los datos que necesita un correo (`email` del paciente) solo salen en `AdminAppointment.patient`, uno a uno. No hay
  listado "citas APPROVED en las próximas N horas".
- Los puntos donde cambia el estado y habría que emitir evento están identificados:

| Evento de negocio | Caso de uso (archivo:método) |
|---|---|
| Solicitud especializada aprobada / rechazada | `AdminAppointmentsUseCase.approve` `:104` / `.reject` `:114` |
| Reprogramación aprobada / rechazada | `RescheduleAppointmentUseCase.approve` `:119` / `.reject` `:140` |
| Cancelación por el paciente | `CancelAppointmentUseCase.cancel` `:43` |
| (Opcional) cita general auto-aprobada | `BookAppointmentUseCase.bookGeneral` `:47` |

- `TransactionRunner` solo expone `inTransaction(Supplier)` (`application/TransactionRunner.java`): el evento debe
  publicarse **después** de que ese bloque retorne, nunca dentro.

### 0.2b Lo que dicen el PRD y las HU (por qué hace falta una épica nueva)

- **PRD §10** fija los tres flujos y dice que n8n se agrega "sin cambiar el núcleo funcional". **PRD §8/§9:** sin
  secretos en el repo; SMTP/SMS/WhatsApp fuera de alcance → el canal es Gmail vía n8n. **RF-19** ya guarda la auditoría
  de estados; los flujos la **complementan**, no la reemplazan (RN-12: la auditoría no se edita).
- **Ocho HU excluyen explícitamente la notificación** y la remiten a "la automatización posterior de PRD §10". Ninguna
  HU actual cubre el correo, los endpoints de automatización ni el publicador de eventos:

| HU | Estado | Lo que deja fuera | Evento / flujo que lo cubre |
|---|---|---|---|
| HU-030 aprobar/rechazar especializada | Completada | correo al paciente | WF-002 `APPOINTMENT_APPROVED` / `REJECTED` |
| HU-031 aprobar/rechazar reprogramación | En validación | correo | WF-002 `RESCHEDULE_APPROVED` / `REJECTED` |
| HU-026 cancelar | En validación | correo de la cancelación | WF-002 `APPOINTMENT_CANCELLED` |
| HU-027 solicitar reprogramación | En validación | correo de la solicitud | (no incluido; ver D-E) |
| HU-028 decidir tras rechazo | En validación | correo del rechazo | cubierto por `RESCHEDULE_REJECTED` |
| HU-023 cita general | Completada | correo | D-E: se excluye por defecto |
| HU-025 mis citas | — | correo de cambios de estado | WF-002 |
| HU-032 auditoría | Completada | "workflows n8n que reaccionan a cambios de estado" | WF-002 (lee el mismo punto de transición) |

- **Precondición real:** varias de esas HU (026, 027, 028, 029, 031, HU-033) siguen **En validación / En desarrollo**
  y F10 de S4 no está cerrada. S5 no debería abrirse hasta que S4 cierre o el usuario lo autorice expresamente.
- **HU-033** exige actualizar el contrato REST en cada HU que publique endpoints: los `/api/automation/**` y el evento
  saliente se documentan en `contrato-rest-citas.md`, y una discrepancia bloquea el cierre.

### 0.3 Estado real de n8n (consultado por MCP el 2026-09-30)

- Instancia central: `https://impulso-n8n.aiacademy.com.co`. Un solo proyecto personal, sin equipos
  (`teamProjectsEnabled: false`), a nombre de otra persona (Juan Carlos Flórez).
- **Ya existen tres borradores inactivos** (`aiBuilderAssisted`, creados el 2026-09-29): WF-001 `6Ks5HWdXadUSBW7o`,
  WF-002 `Cu7kjdPURjE8LnTp`, WF-003 `OJqkZkMKhoJJTcXc`. **Ninguno es utilizable tal cual**:

| # | Problema | Dónde |
|---|---|---|
| 1 | Llaman a `/api/v1/automation/appointments/upcoming` y `/daily` con `X-Automation-Key`: **endpoints que no existen** | WF-001, WF-003 |
| 2 | Envían con el nodo **SMTP** (`emailSend`), no Gmail; la guía exige Gmail + OAuth propio | los tres |
| 3 | Leen `$env.CITAS_API_URL`, `CITAS_AUTOMATION_KEY`, `LAB_FROM_EMAIL`… : variables de entorno de la instancia compartida que el estudiante no controla (y n8n suele bloquear `$env` en nodos) | los tres |
| 4 | Campos inventados: `scheduledStartAt`, `locationCode`; el contrato real es `date` + `startTime` + `site.code` | WF-001, WF-003 |
| 5 | Webhook **sin autenticación**, y la rama "evento inválido" responde `accepted:true` igual que la válida | WF-002 |
| 6 | Sin registro/trazabilidad (la guía lo exige en los tres), sin idempotencia, sin manejo de error | los tres |

- **Credenciales existentes:** solo dos de Google Sheets. **No hay credencial de Gmail.**
- Las herramientas MCP disponibles cubren todo lo que pide S6: buscar/leer/crear/actualizar/validar/ejecutar/publicar
  workflows, leer ejecuciones, credenciales (sin secretos) y *Data Tables*.

### 0.4 Bloqueadores transversales (hay que resolverlos antes de construir)

| ID | Bloqueador | Consecuencia |
|---|---|---|
| **B1** | n8n es remoto; la API corre en `localhost:8081`. **n8n no puede llamar a tu API.** | WF-001/003 no funcionan sin túnel (cloudflared/ngrok) o API desplegada. WF-002 no tiene el problema: Spring sale a Internet hacia n8n. |
| **B2** | No hay credencial de servicio en la API. | Hay que crearla (nueva HU). Ver decisión D-A. |
| **B3** | Falta Gmail OAuth (Google Cloud del estudiante). | Acción manual tuya; yo no puedo completar OAuth. |
| **B4** | Instancia **compartida**: el path `citas/status-change` del webhook y los nombres `WF-00X` colisionan con los de otros estudiantes. | Sufijo propio en path y nombre. |
| **B5** | Regla dura del workspace: *no se implementa sin HU `Aprobada`*. Estos endpoints y el publicador de eventos no están en ninguna HU. | Antes de código: épica **EP-010** y sus HU vía `scrum-spec-writer`, aprobadas por ti. |
| **B6** | Los pacientes del laboratorio son ficticios (`@ejemplo.test`). Gmail real enviaría a direcciones que no existen. | Modo prueba con destinatario forzado a tu correo (parámetro del flujo). |

---

## 1. Decisiones que necesito de ti

| ID | Decisión | Recomendación |
|---|---|---|
| **D-A** ✅ | ¿Cómo se autentica n8n contra la API? (a) **API key dedicada, solo lectura, en `/api/automation/**`**; (b) cuenta ADMIN con login desde n8n. | **DECIDIDO: (a)**. (b) da a n8n poder total de ADMIN, obliga a manejar refresh por cookie y access de 15 min. (a) es privilegio mínimo y lo pide S5. |
| **D-B** ✅ | ¿Cómo llega n8n a tu API? Túnel (cloudflared/ngrok) o API desplegada. | **DECIDIDO: túnel temporal** para la demo; se cierra al terminar. |
| **D-C** | Ventana del recordatorio. El PRD no la fija. | Citas `APPROVED` que empiezan en las próximas **24 h**, chequeo cada hora. |
| **D-D** | Anti-duplicado del recordatorio: (a) *Data Table* de n8n; (b) columna `reminder_sent_at` (migración V11). | **(a)** para no tocar el esquema; el riesgo (perder la tabla reenvía) queda como residual. |
| **D-E** | ¿Qué eventos notifica WF-002? | APPROVED/REJECTED de especializada, reprogramación aprobada/rechazada y cancelación. **Excluir** la cita general auto-aprobada (el paciente ya ve la respuesta). |
| **D-F** | Entrega del webhook: (a) *best-effort* (tras el commit, reintentos, log); (b) tabla *outbox* + planificador. | **(a)**. El fallo de n8n nunca debe romper ni revertir la operación de negocio. (b) queda como mejora documentada. |
| **D-G** | ¿WF-003 entra? La guía lo marca bonus. | Sí, al final y solo si WF-001/002 están cerrados. |
| **D-H** ✅ | ¿Reutilizo los 3 borradores o creo nuevos? | **DECIDIDO: crear de cero** con prefijo propio `jhonNuñez-` (varias personas trabajan en la misma instancia). Los borradores `6Ks5HWdXadUSBW7o`, `Cu7kjdPURjE8LnTp` y `OJqkZkMKhoJJTcXc` **no se tocan: ni se editan ni se archivan**. |
| **D-I** | Los tres webhooks del `.env`: ¿WF-001 y WF-003 llevan **además** un Webhook de disparo a demanda junto al Schedule? | **Sí.** Permite la "ejecución controlada" que exige S6 sin esperar la hora del cron, y cada flujo queda con su URL y su variable. |

---

## 2. Trabajo común (Fase 0) — antes de cualquier flujo

**Repos afectados:** raíz (este plan, `.env.example`, `docker-compose.yml`) y `citas-api`. **`citas-web` no cambia.**

1. **Especificación** (`scrum-spec-writer`, tú apruebas): épica **EP-010 Automatizaciones n8n** con
   - HU-034 *Consultar citas para automatización* (lectura con API key: próximas 24 h y resumen diario);
   - HU-035 *Publicar eventos de cambio de estado a n8n*;
   - HU-036 *Versionar y documentar los flujos n8n* (JSON + riesgos residuales).
   Sin HU `Aprobada` no se toca código.
2. **Seguridad de la API key** (`backend-security`): una **segunda `SecurityFilterChain`** con `securityMatcher("/api/automation/**")`,
   `@Order` antes de la principal, stateless, filtro que compara la cabecera `X-Automation-Key` con
   `MessageDigest.isEqual` (tiempo constante), solo `GET`. Sin la clave → 401 `ProblemDetail` en español. La cadena
   principal sigue en `denyAll` para todo lo demás. La clave solo por variable de entorno `AUTOMATION_API_KEY`,
   mínimo 32 bytes y rechazo del marcador `CHANGE_ME` (mismo patrón que `JWT_ACCESS_SECRET`). **No se loguea.**
3. **Variables** (`.env.example` + `docker-compose.yml` + `application.yml`, sin valores reales). Las **tres
   configuraciones de webhook, una por flujo**, más la clave de la API y el secreto compartido:

   | Variable | Flujo | Uso | Vacía significa |
   |---|---|---|---|
   | `N8N_WEBHOOK_WF001_URL` | WF-001 | disparo **a demanda** de los recordatorios (ejecución controlada, pruebas) | función desactivada |
   | `N8N_WEBHOOK_WF002_URL` | WF-002 | **evento de cambio de estado** que Spring publica en cada transición | no se publica nada |
   | `N8N_WEBHOOK_WF003_URL` | WF-003 | disparo **a demanda** del resumen diario | función desactivada |
   | `N8N_WEBHOOK_SECRET` | los tres | valor de la cabecera `X-Webhook-Secret` que valida cada nodo Webhook | el backend no envía |
   | `AUTOMATION_API_KEY` | WF-001, WF-003 | clave de `X-Automation-Key` para `/api/automation/**` | la cadena de automatización rechaza todo |

   La configuración de Spring se agrupa en una clase `@ConfigurationProperties("app.n8n")` con los tres URL y el
   secreto, validada al arrancar (URL `https`, rechazo de `CHANGE_ME`). Solo WF-002 lo consume Spring en operación
   normal; los otros dos quedan disponibles para disparo manual y para las pruebas de S5/S6 (**interpretación mía
   de tu indicación: confírmala en D-I**). El `.env` real lo rellenas tú; yo no lo leo ni lo imprimo.
4. **Túnel (D-B)** y URL pública → se guarda como valor dentro de la credencial de n8n, no en el repo.
5. **Credenciales en n8n** (tú, en la UI; nunca por chat): `Gmail OAuth2` propia (scope mínimo: solo
   `gmail.send`), `Header Auth` con `X-Automation-Key`, `Header Auth` para el secreto del webhook.
6. **Data Table `citas_notification_log`** (creable por MCP): `eventId`, `workflow`, `appointmentId`, `recipientMasked`,
   `result` (`SENT|FAILED|SKIPPED`), `error`, `executionId`, `createdAt`. Es el "registro/trazabilidad" de los tres flujos.
   Sin cuerpo del correo ni emails completos.
6b. **Convención de nombres (D-H):** en n8n, prefijo `jhonNuñez-` en workflows, Data Table y credenciales
   (`jhonNuñez-WF-001-appointment-reminders`, `jhonNuñez-citas_notification_log`, `jhonNuñez-Gmail`…). Los **paths de
   webhook no llevan ñ** (van en la URL): `citas/jhon-nunez/reminders`, `…/status-change`, `…/daily-summary`. En el repo,
   los JSON conservan el nombre que exige la guía (`WF-001-appointment-reminders.json`…) y dentro llevan el nombre con prefijo.
7. **Carpeta** `citas-api/automations/n8n/` con un `README.md` (cómo importar, credenciales esperadas, riesgos).

**Criterio de salida de Fase 0:** EP-010 aprobada, `GET /api/automation/ping` responde 401 sin clave y 200 con ella,
credenciales creadas, túnel verificado con `curl` desde fuera.

---

## 3. PLAN WF-001 — Recordatorios de citas próximas (S5)

**Objetivo:** cada hora, recordar por Gmail a los pacientes con cita `APPROVED` en las próximas 24 h, una sola vez por cita.

### 3.1 Contrato nuevo (backend)

`GET /api/automation/appointments/upcoming?hours=24` — `X-Automation-Key`, solo lectura.

```json
[{ "appointmentId": 57, "patientFirstName": "Ana", "patientEmail": "ana.perez@ejemplo.test",
   "date": "2026-10-01", "startTime": "08:00", "endTime": "08:30",
   "site": { "code": "HIC", "name": "…", "address": "…" },
   "professional": "…", "specialty": "Medicina General" }]
```

- Solo `APPROVED`, futuras, dentro de la ventana, en `America/Bogota`, ordenadas por inicio.
- **Minimización de datos:** sin documento, teléfono ni historial. `hours` acotado (1–72).
- 401 sin clave; 400 si `hours` es inválido (mismo `ProblemDetail`).

### 3.2 Backend (capas, de dentro hacia fuera)

| Capa | Cambio |
|---|---|
| `application/appointment/AppointmentQueries` | método `findApprovedStartingBetween(LocalDateTime from, LocalDateTime to)` y su vista mínima |
| `infrastructure/persistence/appointment/JdbcAppointmentQueries` | SQL sobre `appointments` ya indexado por fecha/hora; filtro de estado **en la consulta** |
| `application/automation/` (nuevo) | `AutomationQueriesUseCase` |
| `infrastructure/rest/automation/` (nuevo) | `AutomationController` + DTO |
| `infrastructure/security/` | cadena secundaria + filtro de API key |
| Tests | integración: sin clave → 401; clave errónea → 401; solo `APPROVED`; excluye pasadas y fuera de ventana; no contiene documento/teléfono; ArchUnit sigue verde |
| Docs | `contrato-rest-citas.md` (sección S5) y `SecurityConfig` documentado |

### 3.3 Workflow n8n (nodos)

`Schedule Trigger (cada hora, zona America/Bogota)` **+ `Webhook POST citas/jhon-nunez/reminders` (Header Auth, disparo a demanda, URL en `N8N_WEBHOOK_WF001_URL`)**, ambos hacia →
`HTTP Request GET upcoming` (Header Auth, **retry 3×, espera 5 s**, timeout 15 s) →
`IF lista vacía → fin` →
`Split Out` →
`Data Table: ¿ya enviado? (appointmentId + date + startTime)` → `IF no enviado` →
`Gmail: enviar (texto plano)` (*On Error: continue*) →
`Data Table: insertar SENT` / rama de error → `insertar FAILED`.

- **Texto plano, no HTML** (los nombres vienen de la API: contenido no confiable, sin inyección de marcado).
- Parámetro `TEST_RECIPIENT`: si está relleno, todo correo va a esa dirección (B6). **Vacío solo en la demo final.**
- Zona horaria del workflow fijada explícitamente; la hora se formatea desde `date`+`startTime`, no de un instante UTC.
- Workflow `errorWorkflow` opcional que registre la caída del HTTP.

### 3.4 Validación (sin activar)

1. `validate_workflow` (estructura) → 2. `prepare_workflow_pin_data` con una respuesta de ejemplo →
3. `test_workflow` con `TEST_RECIPIENT` = tu correo → 4. comprobar con `search_workflow_executions` que se ejecutó,
que llegó **un** correo y que la tabla tiene **una** fila `SENT` → 5. segunda ejecución: debe dar `SKIPPED`/0 correos
(idempotencia) → 6. apagar la API y repetir: debe quedar `FAILED` sin duplicar → 7. solo entonces `publish_workflow`.

### 3.5 Evidencia S5 y cierre

- Invocación MCP exitosa desde el agente (listar → inspeccionar → ejecutar → leer ejecución), registrada en `EVIDENCIAS_S5.md`.
- Export a `citas-api/automations/n8n/WF-001-appointment-reminders.json` **sin credenciales ni IDs de credencial sensibles**.
- **Bloque de seguridad (25–30 min de la guía):** demostración del issue/comentario/README/respuesta MCP envenenado
  tratado como dato; riesgos residuales por escrito (ver §7).
- Commit en `citas-api`: `feat(s5): add n8n reminder workflow and MCP integration evidence`.

**Riesgos propios:** duplicados si se pierde la Data Table; ventana de 24 h con hora de ejecución variable (recordatorio
entre 23 y 24 h antes); zona horaria; clave en una cabecera viaja por el túnel (HTTPS obligatorio).

---

## 4. PLAN WF-002 — Notificación de cambio de estado (S6)

**Objetivo:** cuando una cita cambia de estado por decisión administrativa o cancelación, Spring avisa a n8n y n8n
envía un correo al paciente y deja registro.

### 4.1 Contrato del evento (Spring → n8n)

`POST {N8N_WEBHOOK_WF002_URL}` con cabecera `X-Webhook-Secret` (credencial Header Auth del nodo Webhook):

```json
{ "eventId": "uuid-v4", "eventType": "APPOINTMENT_APPROVED | APPOINTMENT_REJECTED | APPOINTMENT_CANCELLED | RESCHEDULE_APPROVED | RESCHEDULE_REJECTED",
  "occurredAt": "2026-10-01T10:15:00-05:00", "appointmentId": 57, "status": "APPROVED",
  "patient": { "firstName": "Ana", "email": "ana.perez@ejemplo.test" },
  "appointment": { "date": "2026-10-05", "startTime": "09:00", "endTime": "09:30",
                   "site": { "code": "ICV", "name": "…" }, "professional": "…", "specialty": "…" },
  "reason": "texto libre opcional (rechazo)" }
```

`reason` es **texto libre escrito por el ADMIN o el paciente** → contenido no confiable en n8n (se inserta solo como texto plano).

### 4.2 Backend

| Capa | Cambio |
|---|---|
| `application/appointment/AppointmentEventPublisher` (**puerto**) | `publish(AppointmentEvent)`; sin Spring ni HTTP |
| `AdminAppointmentsUseCase.approve/reject`, `RescheduleAppointmentUseCase.approve/reject`, `CancelAppointmentUseCase.cancel` | llamar al puerto **después** de que `tx.inTransaction` retorne, con la vista ya leída; un fallo del publicador se captura y se registra, **nunca** se propaga |
| `infrastructure/automation/N8nWebhookPublisher` (**adaptador**) | `RestClient` con timeouts (conexión 2 s, lectura 5 s), hasta 3 reintentos con espera creciente, ejecución asíncrona, cabecera de secreto, log sin cuerpo ni email |
| `NoOpAppointmentEventPublisher` | activo si `N8N_WEBHOOK_WF002_URL` está vacío → tests y laboratorio sin n8n no cambian |
| Tests | caso de uso con publicador falso: evento correcto en cada transición y **ninguno** si la transacción falla; fallo del publicador no revierte ni cambia el 200; adaptador contra servidor HTTP local (cabecera, cuerpo, reintentos); `HexagonalArchitectureTest` verde |
| Docs | contrato del evento en `contrato-rest-citas.md`; decisión D-F en `dec-007` |

### 4.3 Workflow n8n (nodos)

`Webhook POST citas/jhon-nunez/status-change` (**Header Auth**, *Response: Using 'Respond to Webhook'*) →
`IF campos válidos` (eventType permitido, email con formato, `appointmentId` numérico) →
`Data Table: ¿eventId ya procesado?` → `Switch por eventType` →
`Set: asunto y texto` (plantilla por tipo, texto plano) →
`Gmail: enviar` →
`Data Table: insertar SENT/FAILED` →
`Respond to Webhook`: **200** `{accepted:true,eventId}` si se procesó; **400** si el evento es inválido; **200 `duplicate:true`**
si ya estaba procesado (Spring no debe reintentar un duplicado).

Correcciones respecto a los borradores ajenos (solo sirven de referencia de errores a evitar): webhook autenticado, respuesta distinta por rama, idempotencia por `eventId`, sin `$env`.

### 4.4 Validación

1. `test_workflow` con el payload de ejemplo (`inputs.webhookData`) por cada uno de los cinco `eventType`.
2. Evento inválido → 400 y **ningún** correo. Sin cabecera de secreto → 401/403 y ningún correo.
3. Mismo `eventId` dos veces → un solo correo.
4. **Prueba real de extremo a extremo:** publicar el flujo, en la app aprobar una solicitud especializada y verificar
   ejecución (`search_workflow_executions`), correo y fila del registro.
5. Apagar el webhook (despublicar) y aprobar otra: la API debe responder 200 igualmente y dejar el fallo en el log.

### 4.5 Cierre

Export `WF-002-status-notifications.json`; commit `feat(s6): …` (un solo commit final de S6 cubre WF-001..003).
**Riesgos propios:** *best-effort* (un evento puede perderse si n8n cae >reintentos); el paciente recibe el `reason` del
ADMIN (revisar que no contenga datos de otras personas); path compartido en instancia central.

---

## 5. PLAN WF-003 — Resumen operativo diario (S6, bonus)

**Objetivo:** cada día, un correo a operaciones con las citas del día agrupadas por sede y estado.

### 5.1 Contrato nuevo

`GET /api/automation/appointments/daily?date=YYYY-MM-DD` (por defecto hoy en `America/Bogota`), `X-Automation-Key`.

```json
{ "date": "2026-10-01",
  "rows": [{ "siteCode": "HIC", "status": "APPROVED", "specialty": "Medicina General", "startTime": "08:00" }],
  "pending": { "pendingRequests": 3, "pendingReschedules": 1 } }
```

Filas **sin datos personales**: para operaciones basta con código de sede, estado y hora. El agrupado lo hace n8n
(la guía pide "agrupar por sede/estado" en el flujo); los pendientes reutilizan el cálculo de `summary()`.

### 5.2 Backend

Método `findByDate` en `AppointmentQueries` + `JdbcAppointmentQueries`; reutiliza la cadena de API key de Fase 0;
pruebas de integración (clave, agrupación por día, sin PII, día sin citas → `rows: []`); contrato actualizado.

### 5.3 Workflow n8n

`Schedule Trigger (07:00 America/Bogota)` **+ `Webhook POST citas/jhon-nunez/daily-summary` (Header Auth, a demanda, URL en `N8N_WEBHOOK_WF003_URL`)**, ambos hacia → `HTTP Request daily` (mismo Header Auth, retry) →
`Code: agrupar por siteCode/status` (con conteos y total; usa `site.code`, no `locationCode`) →
`IF hay citas o hay pendientes` (decisión: día vacío → enviar "sin actividad" o saltar) →
`Gmail: resumen` (HTML **solo** con números y códigos de catálogo, nunca texto libre) →
`Data Table: insertar SENT/FAILED`.

Destinatario de operaciones: parámetro del flujo (no `$env`); en pruebas, tu correo.

### 5.4 Validación y cierre

Pin data con un día de 6 filas y otro vacío; verificar totales a mano; ejecución controlada; publicar. Export
`WF-003-daily-operational-summary.json`. Si el tiempo no alcanza, se declara fuera de entrega sin afectar S6.

---

## 6. Orden de ejecución y entregables

| Paso | Qué | Quién | Sale |
|---|---|---|---|
| 1 | Resolver D-C…D-G y D-I pendientes, crear credenciales Gmail y túnel | **Tú** | decisiones cerradas |
| 2 | EP-010 y HU-034/035/036 | `scrum-spec-writer` → **tú apruebas** | HU `Aprobada` |
| 3 | Cadena de API key + `/api/automation/**` + `upcoming` | `backend-security`, `backend-persistence`, `backend-domain` | backend WF-001 |
| 4 | Verificación independiente | `backend-verifier` | PASS/FAIL por CA |
| 5 | WF-001 en n8n (crear `jhonNuñez-WF-001-…` desde cero) + pruebas + MCP + riesgos | hilo principal (MCP) | **Cierre S5** |
| 6 | Puerto de eventos + publicador + WF-002 | `backend-domain`, hilo principal | backend WF-002 |
| 7 | Verificación independiente + prueba E2E real | `backend-verifier` | PASS/FAIL |
| 8 | (Opcional) `daily` + WF-003 | igual | bonus |
| 9 | Export JSON, `EVIDENCIAS_S5/S6.md`, wiki (`LEARN`), commits | hilo principal + `wiki-keeper` | **Cierre S6** |

**Archivos que se crean o tocan (plan cross-repo):**
- `citas-api`: `application/automation/*`, `application/appointment/AppointmentQueries.java`,
  `AppointmentEventPublisher.java`, cuatro casos de uso de §0.2, `infrastructure/rest/automation/*`,
  `infrastructure/security/*` (cadena + filtro), `infrastructure/automation/*`, `infrastructure/persistence/appointment/JdbcAppointmentQueries.java`,
  `src/test/**`, `automations/n8n/*.json` + `README.md`, `.env.example`, `docs/wiki/**`.
- Raíz: `docker-compose.yml`, `.env.example`, `EVIDENCIAS_S5.md`, `EVIDENCIAS_S6.md`.
- `citas-web`: **ninguno**.

Commits en `develop`, en español, Conventional Commits; **sin push sin tu confirmación**.

---

## 7. Riesgos residuales (base para el documento que exige S5)

1. **Contenido no confiable hacia n8n y hacia el agente:** `reason` de rechazo/cancelación, nombres, y cualquier respuesta
   MCP o de ejecución son datos. Mitigación: texto plano, validación de campos, el agente no ejecuta instrucciones halladas
   en ellos. **Residual:** un texto libre malicioso puede llegar al correo del paciente.
2. **API key de larga vida en una instancia compartida:** privilegio mínimo (solo lectura, sin PII extra), pero quien
   administre la instancia puede leerla. Mitigación: rotación y revocación = cambiar la variable.
3. **Entrega best-effort:** eventos perdidos si n8n cae más allá de los reintentos.
4. **Anti-duplicado en Data Table:** si se borra, se reenvían recordatorios.
5. **Túnel público:** superficie expuesta mientras dure la demo; HTTPS y clave obligatorios, cerrar al terminar.
6. **Instancia central compartida:** colisión de paths/nombres y visibilidad de ejecuciones por otros usuarios.
7. **Correos a direcciones ficticias:** rebotes y reputación del remitente; por eso el modo `TEST_RECIPIENT`.
8. **Gmail OAuth personal:** tokens ligados a tu cuenta; scope `gmail.send` únicamente.

---

## 8. Preguntas abiertas para la wiki (`sintesis-preguntas-abiertas`)

- Ventana y frecuencia de recordatorio (D-C) — el PRD §10 no la define.
- Política ante evento no entregado (D-F).
- Si la cita general auto-aprobada debe notificar (D-E).
- Qué hacer en WF-003 con un día sin citas.

---

## 8b. Estado de la construcción en n8n (2026-09-30)

| Flujo | Id en n8n | Estado |
|---|---|---|
| `jhonNuñez-WF-001-appointment-reminders` | `9vNgFpXjjAkwse7o` | creado, probado con datos fijados, **inactivo** |
| `jhonNuñez-WF-002-status-notifications` | `7XF4DTWA11YViP42` | creado, probado con datos fijados, **inactivo** |
| `jhonNuñez-WF-003-daily-operational-summary` | `BRksx12kTEtI5r2l` | creado, probado con datos fijados, **inactivo** |

No verificado todavía: autenticación real del webhook, llamada real a la API (aún no existe `/api/automation/**`), envío real por Gmail (sin credencial), rama 502 y día vacío. Las filas `TEST-…`, `9001`, `9002` y `WF-003|2026-10-01` de la Data Table son de prueba: bórralas desde la interfaz antes de la demo.
---

## 9. Lista de verificación de los pasos planeados

Convención: `[ ]` pendiente · `[x]` hecho con evidencia. Cada casilla se marca **solo** con evidencia concreta
(salida de comando, id de ejecución, archivo). Quien implementa no verifica: los bloques **V** los cierra
`backend-verifier` o tú.

### Fase A — Decisiones y precondiciones (tú)
- [x] A1a. D-A (API key dedicada), D-B (túnel temporal) y D-H (workflows nuevos `jhonNuñez-`) decididas el 2026-09-30
- [ ] A1b. Pendientes: D-C (ventana 24 h), D-D (anti-duplicado), D-E (eventos), D-F (entrega), D-G (bonus), D-I (webhooks a demanda)
- [ ] A2. S4 cerrada o autorización expresa de abrir S5 con HU en `En validación` (F10 pendiente)
- [ ] A3. Nombres fijados: `jhonNuñez-WF-001-appointment-reminders`, `jhonNuñez-WF-002-status-notifications`, `jhonNuñez-WF-003-daily-operational-summary`; `search_workflows` confirma que no colisionan y los borradores ajenos siguen intactos
- [ ] A4. Proyecto Google Cloud propio con Gmail API activada y OAuth (scope `gmail.send`)
- [ ] A5. Túnel o URL pública de la API elegida y probada con `curl` desde fuera de tu red

### Fase B — Especificación (`scrum-spec-writer`)
- [x] B1. EP-010 creada en `docs/wiki/scrum/epicas/` (`EP-010-automatizaciones-n8n.md`, estado `Borrador`)
- [x] B2. HU-034, HU-035 y HU-036 escritas con CA y DoD, todas en `Borrador` (2026-09-30)
- [ ] B3. Tú apruebas cada HU (`Aprobada`); si delegas, queda como "aprobación delegada" en su historial
- [x] B4. `docs/wiki/scrum/README.md` actualizado (EP-010, Sprint 9 y 10 propuestos, trazabilidad PRD §10)
- [x] B5. Preguntas abiertas registradas en `sintesis-preguntas-abiertas` (INC-041…INC-046 viven en EP-010)

### Fase C — Configuración y secretos
- [ ] C1. `.env.example` (raíz) con `N8N_WEBHOOK_WF001_URL`, `N8N_WEBHOOK_WF002_URL`, `N8N_WEBHOOK_WF003_URL`, `N8N_WEBHOOK_SECRET`, `AUTOMATION_API_KEY` **sin valores reales**
- [ ] C2. `docker-compose.yml` pasa las cinco variables al servicio `citas-api-dev` con `:-` vacío por defecto
- [ ] C3. `application.yml` las lee bajo `app.n8n.*`; arranque falla con `CHANGE_ME`, URL no `https` o clave < 32 bytes
- [ ] C4. Tu `.env` real rellenado (yo no lo abro); `git check-ignore .env` confirma que no se versiona
- [ ] C5. `git diff --cached` revisado antes de stagear: ningún secreto, `.env`, `target/` ni dump

### Fase D — Backend WF-001 (`/api/automation/upcoming`)
- [ ] D1. Segunda `SecurityFilterChain` para `/api/automation/**`, stateless, solo `GET`
- [ ] D2. Filtro de API key con comparación de tiempo constante; clave nunca en logs
- [ ] D3. `AppointmentQueries.findApprovedStartingBetween` + SQL con filtro de estado en la consulta
- [ ] D4. `AutomationQueriesUseCase` y `AutomationController` sin reglas de negocio en el controlador
- [ ] D5. Prueba: sin clave → 401; clave errónea → 401; rol USER/ADMIN con JWT no sustituye la clave
- [ ] D6. Prueba: solo `APPROVED`, futuras, dentro de ventana, en `America/Bogota`
- [ ] D7. Prueba: la respuesta no contiene documento ni teléfono
- [ ] D8. `HexagonalArchitectureTest` verde; suite completa en Docker verde (`mvn -B test`)
- [ ] D9. `contrato-rest-citas.md` actualizado (HU-033)
- [ ] **V1.** `backend-verifier` clasifica los CA de HU-034: sin FAIL

### Fase E — n8n WF-001 (S5)
- [ ] E1. Credenciales creadas en n8n: Gmail OAuth2, Header Auth de la API key, Header Auth del webhook
- [x] E2. Data Table `citas_notification_log` creada y visible con `search_data_tables` — creada: `jhonNuñez-citas_notification_log`, id `iqNu0V8hyF7mXAau`
- [x] E3. `jhonNuñez-WF-001-appointment-reminders` creado desde cero: Schedule **y** Webhook a demanda, HTTP con reintentos, Gmail, registro — creado: id `9vNgFpXjjAkwse7o` (inactivo)
- [x] E4. `validate_workflow` sin errores — validado antes de crear; 0 errores
- [x] E5. `test_workflow` con datos fijados y `TEST_RECIPIENT` = tu correo: llega **un** correo — ejecuciones 42 y 44 con datos fijados; el envío de Gmail fue simulado, no hubo correo real
- [x] E6. Segunda ejecución: 0 correos nuevos (idempotencia) y fila `SKIPPED`/sin duplicar — ejecución 44: la cita 9001 se descartó y solo pasó la 9002
- [ ] E7. Con la API apagada: queda `FAILED` y no hay correos duplicados
- [ ] E8. Ejecución revisada con `search_workflow_executions` (id anotado como evidencia)
- [ ] E9. `publish_workflow` **solo después** de E4–E8
- [ ] E10. Invocación MCP desde el agente documentada (listar → inspeccionar → ejecutar → leer ejecución)
- [ ] E11. Bloque de seguridad: demo de contenido no confiable + riesgos residuales (§7) por escrito
- [ ] E12. `WF-001-appointment-reminders.json` exportado a `citas-api/automations/n8n/`, sin credenciales
- [ ] E13. `EVIDENCIAS_S5.md` y `LEARN` en la wiki (`log.md`, `index.md` si cambió la estructura)
- [ ] E14. Commit `feat(s5): add n8n reminder workflow and MCP integration evidence` en `develop`; **sin push** hasta que lo confirmes

### Fase F — Backend WF-002 (evento de estado)
- [ ] F1. Puerto `AppointmentEventPublisher` en `application` sin dependencias de Spring/HTTP
- [ ] F2. Los cinco puntos de §0.2 publican **después** de `tx.inTransaction`, nunca dentro
- [ ] F3. `N8nWebhookPublisher`: timeouts, reintentos, cabecera `X-Webhook-Secret`, log sin cuerpo ni email
- [ ] F4. `NoOpAppointmentEventPublisher` cuando `N8N_WEBHOOK_WF002_URL` está vacía
- [ ] F5. Prueba: cada transición emite el `eventType` correcto con `eventId` único
- [ ] F6. Prueba: transacción que falla → **ningún** evento
- [ ] F7. Prueba: publicador que lanza excepción → la operación sigue respondiendo 200 y no se revierte
- [ ] F8. Prueba del adaptador contra servidor HTTP local (cabecera, cuerpo, reintentos)
- [ ] F9. ArchUnit y suite completa en verde; contrato del evento en `contrato-rest-citas.md`
- [ ] **V2.** `backend-verifier` sobre HU-035: sin FAIL

### Fase G — n8n WF-002 (S6)
- [x] G1. `jhonNuñez-WF-002-status-notifications` creado desde cero: Webhook con Header Auth, validación, idempotencia por `eventId`, Switch por `eventType` — creado: id `7XF4DTWA11YViP42` (inactivo)
- [x] G2. Respuestas distintas: 200 válido, 400 inválido, 200 `duplicate:true` — ramas 200 procesado (ej. 39), 200 duplicado (ej. 41) y 400 (ej. 40) ejercitadas; 502 sin probar
- [ ] G3. `test_workflow` con los cinco `eventType`: un correo por cada uno
- [ ] G4. Evento inválido → 400 y ningún correo; sin secreto → rechazado y ningún correo
- [x] G5. Mismo `eventId` dos veces → un solo correo — ejecuciones 39 y 41: un solo envío
- [ ] G6. `publish_workflow` y **prueba real**: aprobar una solicitud en la app → ejecución, correo y fila de registro
- [ ] G7. Webhook despublicado + aprobar otra cita → la API responde 200 y deja el fallo en el log
- [ ] G8. `WF-002-status-notifications.json` exportado

### Fase H — WF-003 (bonus, solo si A/D/E/F/G cerradas)
- [ ] H1. `GET /api/automation/appointments/daily` con pruebas (clave, agrupación, sin PII, día vacío)
- [x] H2. `jhonNuñez-WF-003-daily-operational-summary`: Schedule 07:00 **y** Webhook a demanda, agrupación en Code con `site.code`, Gmail, registro — creado: id `BRksx12kTEtI5r2l` (inactivo)
- [x] H3. Pin data con día de 6 filas y día vacío; totales verificados a mano — ejecución 43: 6 filas agrupadas bien; día vacío sin probar
- [ ] H4. Publicado tras validar; `WF-003-daily-operational-summary.json` exportado

### Fase I — Cierre S6
- [ ] I1. Los tres (o dos) JSON en `citas-api/automations/n8n/` + `README.md` con credenciales esperadas
- [ ] I2. Ningún JSON contiene tokens, claves ni correos reales (revisión con `grep`)
- [ ] I3. `EVIDENCIAS_S6.md` con ids de ejecución, capturas y riesgos residuales
- [ ] I4. Agente demuestra: listar, inspeccionar, crear/actualizar, validar con ejecución controlada y reintento ante error
- [ ] I5. Wiki: `LEARN` ejecutado (decisiones D-A…D-I, contrato del evento, preguntas abiertas) y `log.md` actualizado
- [ ] I6. HU-034/035/036 en `Completada` solo con matriz de evidencia completa y DoD en `Cumple`
- [ ] I7. Commit `feat(s6): finalize agentic appointment platform and version n8n automations` en `citas-api` (y en la raíz si tocó `.env.example`/compose)
- [ ] I8. Merge `develop → main` solo si tú lo declaras estable; push solo con tu confirmación
